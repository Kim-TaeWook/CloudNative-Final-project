import pika
import pymysql
import redis
import json
import time
import sys
import os

# ===============================================
# 1. DB 및 Redis 연결 설정 (환경 변수 또는 기본값 사용)
# ===============================================

DB_HOST = os.getenv('DB_HOST', 'final_db')
DB_USER = os.getenv('DB_USER', 'game_user')
DB_PASS = os.getenv('DB_PASS', 'game_password123')
DB_NAME = os.getenv('DB_NAME', 'fruit_box_db')
REDIS_HOST = os.getenv('REDIS_HOST', 'final_redis')
QUEUE_HOST = os.getenv('QUEUE_HOST', 'queue')
LEADERBOARD_KEY = "leaderboard:fruit_box" # Redis 랭킹 키

def get_db_connection():
    """MySQL DB 연결 함수 (연결 실패 시 재시도)"""
    while True:
        try:
            conn = pymysql.connect(
                host=DB_HOST, user=DB_USER, password=DB_PASS, database=DB_NAME,
                cursorclass=pymysql.cursors.DictCursor,
                connect_timeout=10
            )
            print("WORKER: MySQL DB 연결 성공")
            return conn
        except pymysql.err.OperationalError as e:
            print(f"WORKER: MySQL 연결 실패. 5초 후 재시도... (오류: {e})")
            time.sleep(5)

def get_redis_connection():
    """Redis 연결 함수 (연결 실패 시 재시도)"""
    while True:
        try:
            r = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)
            r.ping()
            print("WORKER: Redis 연결 성공")
            return r
        except redis.exceptions.ConnectionError as e:
            print(f"WORKER: Redis 연결 실패. 5초 후 재시도... (오류: {e})")
            time.sleep(5)

# 전역 변수로 DB, Redis 연결 초기화
db_conn = get_db_connection()
redis_conn = get_redis_connection()

# ===============================================
# 2. 메시지 처리 콜백 함수 (우체부의 실제 업무)
# ===============================================

def on_message_received(ch, method, properties, body):
    """RabbitMQ에서 메시지를 수신했을 때 호출되는 함수"""
    
    print(f"WORKER: [x] 메시지 수신: {body.decode()}")
    
    try:
        data = json.loads(body.decode())
        email = data['email']
        score = int(data['score']) # 점수는 정수형으로

        # --- 1. MySQL (DB)에 영구 저장 ---
        global db_conn
        try:
            db_conn.ping(reconnect=True) # DB 연결이 끊겼으면 재연결
            with db_conn.cursor() as cur:
                cur.execute("INSERT INTO scores (user_email, score) VALUES (%s, %s)", (email, score))
            db_conn.commit()
            print(f"WORKER: [db] {email}의 {score}점 DB 저장 완료.")
        except Exception as e:
            print(f"WORKER: [db] DB 저장 실패! {e}")
            db_conn.rollback() # 오류 시 롤백
            raise Exception(f"DB 저장 실패: {e}") # 상위 try...except로 오류를 넘김
            
        # --- 2. Redis (실시간 랭킹보드) 업데이트 (A+ 핵심) ---
        global redis_conn
        try:
            # [수정] redis_conn.ping()은 인자를 받지 않습니다.
            redis_conn.ping() # Redis 연결이 끊겼으면 여기서 예외 발생
            
            current_high_score_str = redis_conn.zscore(LEADERBOARD_KEY, email)
            current_high_score = 0
            
            if current_high_score_str is not None:
                current_high_score = int(current_high_score_str)

            if score > current_high_score:
                redis_conn.zadd(LEADERBOARD_KEY, {email: score})
                print(f"WORKER: [redis] {email}의 최고 점수 {score}점으로 랭킹 갱신.")
            else:
                print(f"WORKER: [redis] {email}의 점수({score})가 최고 점수({current_high_score})보다 낮아 랭킹 갱신 안 함.")
        
        except Exception as e:
            print(f"WORKER: [redis] 랭킹 업데이트 실패! {e}")
            raise Exception(f"Redis 갱신 실패: {e}") # 상위 try...except로 오류를 넘김

        # --- 3. 작업 완료 확인 (모두 성공 시) ---
        ch.basic_ack(delivery_tag=method.delivery_tag)
        print(f"WORKER: [o] 처리 완료: {email} - {score}점")

    except Exception as e:
        print(f"WORKER: [!] 작업 실패: {e}. 메시지를 큐로 반환합니다.")
        # (중요) DB는 성공하고 Redis가 실패하면 NACK 루프에 빠지므로,
        # 실패 시 requeue=False로 메시지를 버리거나 "Dead Letter Queue"로 보내야 하지만,
        # 지금은 디버깅을 위해 requeue=True로 둡니다.
        # (실제로는 DB/Redis 트랜잭션을 묶어야 함)
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
        
        # 연결 재시도 로직
        if not db_conn.open:
            db_conn = get_db_connection()
        try:
            redis_conn.ping()
        except redis.exceptions.ConnectionError:
            redis_conn = get_redis_connection()


# ===============================================
# 3. RabbitMQ 연결 및 메시지 대기 (우체통 감시)
# ===============================================

def start_worker():
    while True:
        try:
            connection = pika.BlockingConnection(pika.ConnectionParameters(host=QUEUE_HOST))
            channel = connection.channel()
            channel.queue_declare(queue='score_queue', durable=True)
            
            print('WORKER: [*] 메시지 대기 중. 종료하려면 CTRL+C')
            # (수정) prefetch_count=1: 워커가 한 번에 하나의 메시지만 가져가도록 설정
            # 한 메시지가 실패하면 다른 워커가 가져갈 수 있게 함 (지금은 1개지만)
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue='score_queue', on_message_callback=on_message_received)
            
            channel.start_consuming()

        except pika.exceptions.AMQPConnectionError as e:
            print(f"WORKER: RabbitMQ 연결 실패. 5초 후 재시도... (오류: {e})")
            time.sleep(5)
        except KeyboardInterrupt:
            print("WORKER: 수동으로 종료됨.")
            sys.exit(0)

if __name__ == '__main__':
    start_worker()