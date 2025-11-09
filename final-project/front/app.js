// ===============================================
// 프론트엔드 AJAX 처리 (app.js)
// ===============================================

// Python/PHP API 서버의 경로 설정
const USER_API_URL = '/user/';   // Nginx Proxy가 /user/로 받음
const SCORE_API_URL = '/score/'; // Nginx Proxy가 /score/로 받음

// 1. 페이지 로드 시 공통 실행
$(document).ready(function() {
    
    // 현재 페이지 URL을 확인
    const currentPage = window.location.pathname;

    // 메인 페이지(index.html)인 경우
    if (currentPage === '/' || currentPage === '/index.html') {
        checkLoginStatus();
        loadRanking();

        $('#logout-btn').on('click', handleLogout);
        $('#refresh-ranking-btn').on('click', loadRanking);
        
        // (game.js가 이 ID를 가진 버튼을 사용함)
        // [점수 등록 테스트] 버튼 클릭 이벤트
        $('#submit-score-btn').on('click', function() {
            const score = $('#score-input').val();
            if (score) {
                submitScore(score);
            } else {
                alert("점수를 입력하세요.");
            }
        });
    }
    // 로그인 페이지(login.html)인 경우
    else if (currentPage.includes('login.html')) {
        $('#login-form').on('submit', function(e) {
            e.preventDefault();
            handleLogin($('#login-email').val(), $('#login-pass').val());
        });
        $('#join-form').on('submit', function(e) {
            e.preventDefault();
            handleJoin($('#join-name').val(), $('#join-email').val(), $('#join-pass').val());
        });
    }
});

// ===============================================
// 2. 핵심 함수 정의
// ===============================================

// (1) 로그인 상태 확인 (메인 페이지용)
function checkLoginStatus() {
    $.ajax({
        url: USER_API_URL + 'check', // Python API 호출
        type: 'GET',
        dataType: 'json',
        success: function(data) {
            if (data.result === 'ok') {
                $('#welcome-msg').text(data.session.username + "님 환영합니다!");
                $('#logout-btn').show();
            }
        },
        error: function(xhr) {
            window.location.href = '/login.html';
        }
    });
}

// (2) 랭킹 불러오기 (메인 페이지용)
function loadRanking() {
    $('#ranking-list').html('<tr><td colspan="3">로딩 중...</td></tr>');
    $.ajax({
        url: SCORE_API_URL + 'get-ranking.php', // PHP API (Redis ZSET)
        type: 'GET',
        dataType: 'json',
        success: function(data) {
            if (data.result === 'ok' && data.ranking.length > 0) {
                let template = '';
                data.ranking.forEach((rank, index) => {
                    template += `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${rank.user_email}</td>
                            <td>${rank.high_score}</td>
                        </tr>
                    `;
                });
                $('#ranking-list').html(template);
            } else if (data.result === 'ok') {
                 $('#ranking-list').html('<tr><td colspan="3">아직 랭킹이 없습니다.</td></tr>');
            } else {
                $('#ranking-list').html(`<tr><td colspan="3">${data.msg}</td></tr>`);
            }
        },
        error: function(xhr) {
            $('#ranking-list').html(`<tr><td colspan="3">랭킹 로드 실패 (PHP 오류)</td></tr>`);
        }
    });
}

// (3) 점수 등록 (메인 페이지용, game.js가 호출)
function submitScore(scoreValue) {
    $('#score-msg').text("점수 등록 요청 중...").css('color', 'blue');
    $.ajax({
        url: SCORE_API_URL + 'submit-score.php', // PHP API (RabbitMQ)
        type: 'POST',
        dataType: 'json',
        data: {
            score: scoreValue
        },
        success: function(data) {
            // "접수 완료" 메시지
            $('#score-msg').text(data.msg).css('color', 'green');
            
            // (중요) 워커가 처리할 시간을 1~2초 정도 기다린 후 랭킹을 새로고침
            setTimeout(loadRanking, 2000); 
        },
        error: function(xhr) {
            // (개선) PHP가 보낸 오류 메시지(JSON)를 표시
            let errorMsg = "점수 등록 실패 (서버 오류)";
            if (xhr.responseJSON && xhr.responseJSON.msg) {
                errorMsg = xhr.responseJSON.msg; // 예: "로그인이 필요합니다."
            }
            $('#score-msg').text(errorMsg).css('color', 'red');
        }
    });
}

// (4) 로그인 (로그인 페이지용)
function handleLogin(email, password) {
    $.ajax({
        url: USER_API_URL + 'login', // Python API
        type: 'POST',
        dataType: 'json',
        data: { email: email, password: password },
        success: function(data) {
            $('#login-msg').text(data.msg).css('color', 'green');
            setTimeout(() => { window.location.href = '/'; }, 1000);
        },
        error: function(xhr) {
            const msg = xhr.responseJSON?.msg || "로그인 실패";
            $('#login-msg').text(msg).css('color', 'red');
        }
    });
}

// (5) 회원가입 (로그인 페이지용)
function handleJoin(name, email, password) {
    $.ajax({
        url: USER_API_URL + 'join', // Python API
        type: 'POST',
        dataType: 'json',
        data: { name: name, email: email, password: password },
        success: function(data) {
            $('#join-msg').text(data.msg).css('color', 'green');
        },
        error: function(xhr) {
            const msg = xhr.responseJSON?.msg || "회원가입 실패";
            $('#join-msg').text(msg).css('color', 'red');
        }
    });
}

// (6) 로그아웃 (메인 페이지용)
function handleLogout() {
    if (!confirm("로그아웃 하시겠습니까?")) return;
    $.ajax({
        url: USER_API_URL + 'logout', // Python API
        type: 'POST',
        dataType: 'json',
        success: function(data) {
            alert(data.msg);
            window.location.href = '/login.html';
        },
        error: function(xhr) { alert("로그아웃 실패"); }
    });
}