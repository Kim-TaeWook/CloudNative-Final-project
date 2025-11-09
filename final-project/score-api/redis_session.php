<?php
// --- 1. Redis 연결 설정 ---
// 'final_redis'는 docker-compose.yml에 정의된 컨테이너 이름
$redis = new Redis();
try {
    $redis->connect('final_redis', 6379);
} catch (RedisException $e) {
    die("Redis 연결 실패: " . $e->getMessage());
}

// --- 2. 세션 쿠키 이름 설정 (Python과 동일하게) ---
// Python 'main.py'의 COOKIE_NAME과 반드시 일치해야 함
session_name("FRUIT_BOX_SID");

// --- 3. Redis 세션 핸들러 설정 ---
// PHP의 기본 세션 저장 방식을 Redis로 변경합니다.
session_set_save_handler(
    // open (세션 시작)
    function ($save_path, $session_name) use ($redis) {
        return true;
    },
    // close (세션 종료)
    function () use ($redis) {
        return true;
    },
    // read (세션 읽기)
    function ($session_id) use ($redis) {
        // Python이 "session:세션ID" 형태로 저장했으므로, 동일한 키로 읽어옴
        $data = $redis->get("session:$session_id");
        return $data ? $data : ''; // 데이터가 없으면 빈 문자열 반환
    },
    // write (세션 쓰기)
    function ($session_id, $session_data) use ($redis) {
        // 1시간(3600초) 유효기간으로 Redis에 저장
        return $redis->setex("session:$session_id", 3600, $session_data);
    },
    // destroy (세션 파괴)
    function ($session_id) use ($redis) {
        // Redis에서 "session:세션ID" 키 삭제
        return $redis->del("session:$session_id");
    },
    // gc (가비지 컬렉션)
    function ($maxlifetime) use ($redis) {
        // Redis의 setex(TTL)가 자동으로 만료시키므로 별도 작업 불필요
        return true;
    }
);
?>