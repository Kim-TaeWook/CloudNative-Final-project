<?php
// docker-compose.yml에 정의된 DB 환경 변수와 일치시킵니다.
$mysql_host = "final_db";        // DB 컨테이너 이름
$mysql_user = "game_user";       // DB 사용자
$mysql_password = "game_password123"; // DB 비밀번호
$mysql_db = "fruit_box_db";     // DB 이름

// MySQL 연결
$connection = mysqli_connect($mysql_host, $mysql_user, $mysql_password, $mysql_db);

if (!$connection) {
    die("DB 연결 실패: " . mysqli_connect_error());
}

// UTF-8 설정 (한글 깨짐 방지)
mysqli_set_charset($connection, "utf8mb4");

// Python API와 세션을 공유하기 위해 redis_session.php를 포함
include_once("./redis_session.php");
?>