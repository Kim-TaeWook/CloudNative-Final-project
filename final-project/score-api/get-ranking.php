<?php
// DB 연결이 아닌, redis_session.php를 직접 include하여
// $redis 객체만 확보합니다.
include_once("./redis_session.php"); 
// ($redis 변수는 redis_session.php에서 생성됨)

$ret = array();
// 'leaderboard:fruit_box' 키는 worker.py가 저장할 키 이름과 일치
$ranking_key = "leaderboard:fruit_box"; 

try {
    // 1. Redis에서 랭킹을 가져옴 (0등부터 9등까지, 점수와 함께)
    // ZREVRANGE(key, start, end, 'WITHSCORES')
    // (Python 워커가 이 키에 zadd로 저장함)
    $raw_ranking = $redis->zRevRange($ranking_key, 0, 9, true);
    
    // 2. Redis 결과를 JSON 배열로 가공
    $ranking = array();
    foreach ($raw_ranking as $email => $score) {
        $ranking[] = array(
            'user_email' => $email,
            'high_score' => (int)$score
        );
    }

    // 3. 성공 응답
    $ret = array('result' => 'ok', 'ranking' => $ranking);
    echo json_encode($ret, JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    // Redis 연결 실패 등 예외 처리
    header('HTTP/1.1 500 Internal Server Error');
    $ret['result'] = "no";
    $ret['msg'] = "랭킹 서버(Redis) 연결 실패: " . $e->getMessage();
    echo json_encode($ret, JSON_UNESCAPED_UNICODE);
}
?>