import pymysql
import redis
import uuid
import re
from fastapi import FastAPI, Request, Response, Form
from fastapi.responses import JSONResponse

# --- 1. FastAPI 앱 초기화 ---
app = FastAPI()

# --- 2. 세션 쿠키 이름 정의 (PHP와 공유할 이름) ---
# PHP의 기본 이름(PHPSESSID) 대신 고유한 이름을 사용
COOKIE_NAME = "FRUIT_BOX_SID"

# --- 3. Redis 연결 설정 ---
# 'final_redis'는 docker-compose.yml에 정의된 컨테이너 이름
try:
    r = redis.Redis(host="final_redis", port=6379, decode_responses=True)
    r.ping()
    print("Redis 연결 성공")
except Exception as e:
    print(f"Redis 연결 실패: {e}")

# --- 4. DB 연결 함수 ---
def get_db():
    """DB 연결 (docker-compose.yml의 환경변수와 일치)"""
    try:
        conn = pymysql.connect(
            host="final_db",        # DB 컨테이너 이름
            user="game_user",       # DB 사용자
            password="game_password123", # DB 비밀번호
            database="fruit_box_db", # DB 이름
            cursorclass=pymysql.cursors.DictCursor
        )
        print("MySQL DB 연결 성공")
        return conn
    except Exception as e:
        print(f"MySQL DB 연결 실패: {e}")
        return None

# --- 5. PHP 세션 호환 함수 ---
# Python 딕셔너리를 PHP 세션 문자열로 변환
def php_session_encode(session_dict: dict) -> str:
    session_str = ""
    for key, value in session_dict.items():
        byte_len = len(str(value).encode("utf-8")) # 값을 문자열로 변환
        session_str += f"{key}|s:{byte_len}:\"{value}\";"
    return session_str

# PHP 세션 문자열을 Python 딕셔너리로 변환
def php_session_decode(session_data: str) -> dict:
    if not session_data:
        return {}
    return dict(re.findall(r'(\w+)\|s:\d+:"([^"]*)"', session_data))

# --- 6. API 엔드포인트: 회원가입 (/join) ---
@app.post("/join")
async def join(email: str = Form(), password: str = Form(), name: str = Form()):
    if not email or not password or not name:
        return JSONResponse(status_code=400, content={"result": "no", "msg": "모든 항목을 입력해주세요."})
    
    conn = get_db()
    if not conn:
        return JSONResponse(status_code=500, content={"result": "no", "msg": "DB 연결 실패"})
    
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO users (email, pass, name) VALUES (%s, %s, %s)", (email, password, name))
        conn.commit()
        return {"result": "ok", "msg": "회원가입 성공"}
    except pymysql.err.IntegrityError: # 이메일 중복 시
        return JSONResponse(status_code=409, content={"result": "no", "msg": "이미 사용중인 이메일입니다."})
    except Exception as e:
        return JSONResponse(status_code=500, content={"result": "no", "msg": f"가입 처리 실패: {e}"})
    finally:
        conn.close()

# --- 7. API 엔드포인트: 로그인 (/login) ---
@app.post("/login")
async def login(response: Response, email: str = Form(), password: str = Form()):
    if not email or not password:
        return JSONResponse(status_code=400, content={"result": "no", "msg": "이메일 또는 비밀번호 누락"})

    conn = get_db()
    if not conn:
        return JSONResponse(status_code=500, content={"result": "no", "msg": "DB 연결 실패"})

    try:
        with conn.cursor() as cur:
            # (주의: 실제 서비스에서는 비밀번호를 해시하여 비교해야 합니다)
            cur.execute("SELECT * FROM users WHERE email=%s AND pass=%s", (email, password))
            user = cur.fetchone()
    finally:
        conn.close()

    if not user:
        return JSONResponse(status_code=401, content={"result": "no", "msg": "로그인 정보가 틀립니다."})

    # 1. 새 세션 ID 생성
    session_id = str(uuid.uuid4())
    
    # 2. PHP가 읽을 수 있도록 세션 데이터 직렬화
    session_data = php_session_encode({
        "useremail": user["email"],
        "username": user["name"]
    })
    
    # 3. Redis에 세션 저장 (유효기간 1시간)
    # (키 이름: "session:세션ID" - PHP 기본 저장 방식과 동일하게)
    try:
        r.setex(f"session:{session_id}", 3600, session_data)
    except Exception as e:
        return JSONResponse(status_code=500, content={"result": "no", "msg": f"Redis 세션 저장 실패: {e}"})

    # 4. 브라우저에 세션 쿠키 발급
    response.set_cookie(
        key=COOKIE_NAME,    # PHP와 동일한 쿠키 이름 사용
        value=session_id,
        httponly=True,      # JavaScript에서 접근 불가
        samesite="Lax"      # CSRF 방어
    )
    
    return {"result": "ok", "msg": "정상 로그인이 되었습니다.", "username": user["name"]}

# --- 8. API 엔드포인트: 로그아웃 (/logout) ---
@app.post("/logout")
async def logout(request: Request, response: Response):
    session_id = request.cookies.get(COOKIE_NAME)
    
    if session_id:
        try:
            # 1. Redis에서 세션 삭제
            r.delete(f"session:{session_id}")
        except Exception as e:
            print(f"Redis 세션 삭제 실패: {e}")
            
    # 2. 브라우저의 쿠키 삭제
    response.delete_cookie(COOKIE_NAME)
    return {"result": "ok", "msg": "로그아웃 완료"}

# --- 9. API 엔드포인트: 세션 확인 (/check) ---
@app.get("/check")
async def check_session(request: Request):
    session_id = request.cookies.get(COOKIE_NAME)
    if not session_id:
        return JSONResponse(status_code=401, content={"result": "no", "msg": "세션 없음"})
    
    try:
        # Redis에서 세션 데이터 읽기
        data = r.get(f"session:{session_id}")
    except Exception as e:
        return JSONResponse(status_code=500, content={"result": "no", "msg": f"Redis 연결 실패: {e}"})

    if not data:
        return JSONResponse(status_code=404, content={"result": "no", "msg": "세션 만료"})
    
    # PHP 세션 문자열을 Python 딕셔너리로 복원
    session_vars = php_session_decode(data)
    
    if "useremail" not in session_vars:
        return JSONResponse(status_code=500, content={"result": "no", "msg": "세션 데이터 손상"})

    return {
        "result": "ok",
        "msg": "세션 유지 중",
        "session": session_vars
    }