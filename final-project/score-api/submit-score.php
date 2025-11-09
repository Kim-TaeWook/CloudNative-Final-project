<?php
// 1. Composer의 Autoloader를 로드 (RabbitMQ 라이브러리)
require_once __DIR__ . '/vendor/autoload.php';
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;

// 2. Redis 세션 핸들러 포함 (로그인 확인용)
include_once("./database.php"); 
session_start(); // 세션을 시작하여 Redis에서 로그인 정보 복원

$ret = array(); // 응답용 JSON

// 3. (세션 공유 확인) 로그인 상태인지 확인
if (!isset($_SESSION['useremail']) || $_SESSION['useremail'] == "") {
    header('HTTP/1.1 401 Unauthorized');
    $ret['result'] = "no";
    $ret['msg'] = "로그인이 필요합니다. (PHP 서버 응답)";
    echo json_encode($ret, JSON_UNESCAPED_UNICODE);
    exit;
}

// 4. 프론트엔드에서 보낸 점수(score) 받기
if (!isset($_POST['score'])) {
    header('HTTP/1.1 400 Bad Request');
    $ret['result'] = "no";
    $ret['msg'] = "점수 데이터가 없습니다.";
    echo json_encode($ret, JSON_UNESCAPED_UNICODE);
    exit;
}

// 5. RabbitMQ에 보낼 메시지(쪽지) 생성
$message_body = json_encode([
    'email' => $_SESSION['useremail'],
    'score' => (int)$_POST['score']
]);

try {
    // 6. RabbitMQ('queue' 컨테이너)에 메시지 전송
    // 'queue'는 docker-compose.yml의 컨테이너 이름
    // (RabbitMQ 기본 계정 guest/guest 사용)
    $connection = new AMQPStreamConnection('queue', 5672, 'guest', 'guest');
    $channel = $connection->channel();

    // 'score_queue'라는 이름의 큐(우체통) 선언
    $channel->queue_declare('score_queue', false, true, false, false);

    // durable(영속성) 메시지로 생성 (RabbitMQ가 재시작되어도 메시지 유지)
    $msg = new AMQPMessage($message_body, ['delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT]);
    
    // 큐에 메시지 발행
    $channel->basic_publish($msg, '', 'score_queue');

    $channel->close();
    $connection->close();

    // 7. 성공 응답 (DB 저장이 아닌 "접수 완료" 응답)
    $ret['result'] = "ok";
    $ret['msg'] = "점수 등록이 접수되었습니다. (비동기 처리)";
    echo json_encode($ret, JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    // 큐 연결 실패 등 예외 처리
    header('HTTP/1.1 500 Internal Server Error');
    $ret['result'] = "no";
    $ret['msg'] = "메시지 큐 연결 실패: " . $e->getMessage();
    echo json_encode($ret, JSON_UNESCAPED_UNICODE);
}
?>