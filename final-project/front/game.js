// ===============================================
// "변형 사과 게임" 최종 로직 (game.js)
// (블루 애플, 판 리셋, UI 로직 추가)
// ===============================================

$(document).ready(function() {
    
    // --- 1. 게임 변수 및 DOM 요소 ---
    let score = 0;
    let timer = 60; // 60초
    let gameInterval;
    let isPlaying = false;
    
    let isDragging = false;
    let selectedApples = []; 
    let currentSum = 0;      

    const $board = $('#game-board');
    const $scoreDisplay = $('#score-display');
    const $timerDisplay = $('#timer-display');
    const $startGameBtn = $('#start-game-btn');
    const $overlay = $('#game-overlay');
    const $gameMessage = $('#game-message');
    
    const BLUE_APPLE_CHANCE = 0.05; // 파란 사과 확률 (5%)

    // --- 2. 드래그 이벤트 리스너 ---

    // (1) 드래그 시작
    $board.on('mousedown', '.apple', function(e) {
        e.preventDefault(); 
        if (!isPlaying) return; 
        
        failSelection(); 
        isDragging = true;
        
        const $apple = $(this);
        $apple.addClass('selected');
        selectedApples.push($apple);
        currentSum += $apple.data('value');
    });

    // (2) 드래그 중
    $board.on('mouseover', '.apple', function() {
        if (!isPlaying || !isDragging) return; 

        const $apple = $(this);
        if ($apple.hasClass('selected')) return; 

        $apple.addClass('selected');
        selectedApples.push($apple);
        currentSum += $apple.data('value');
    });

    // (3) 드래그 종료 (마우스를 뗐을 때)
    $(document).on('mouseup', function() {
        if (!isPlaying || !isDragging) {
             isDragging = false;
             return; 
        }
        
        if (currentSum === 10) {
            successSelection();
        } else {
            failSelection();
        }
    });

    // (4) 드래그가 게임판 밖으로 나갔을 때
    $board.on('mouseleave', function() {
        if (isDragging) {
            console.log("Mouse left the board, failing selection.");
            failSelection();
        }
    });

    // --- 3. 선택 성공 함수 (블루 애플 로직) ---
    function successSelection() {
        // 점수 = 연결한 사과 1개당 1점
        const points = selectedApples.length; 
        score += points; 
        $scoreDisplay.text(score);

        // 점수 획득 애니메이션
        const $lastApple = selectedApples[selectedApples.length - 1];
        const $floatText = $(`<div class="score-float">+${points}</div>`);
        $lastApple.append($floatText);
        setTimeout(() => $floatText.remove(), 1000);

        // 파란 사과가 포함되었는지 확인
        let containsBlueApple = false;
        selectedApples.forEach($el => {
            if ($el.data('isBlue')) {
                containsBlueApple = true;
            }
        });

        // 선택된 사과 제거
        selectedApples.forEach($el => $el.addClass('removing')); 
        setTimeout(() => {
            selectedApples.forEach($el => $el.remove()); 
            
            // 파란 사과가 있으면 판 리셋
            if (containsBlueApple) {
                console.log("Blue apple found! Resetting board.");
                resetBoard(); // 판 리셋 함수 호출
            }
            // 파란 사과가 없으면 "No Refill"

        }, 200); // 200ms = style.css의 transition 시간
        
        // 변수 초기화
        selectedApples = [];
        currentSum = 0;
        isDragging = false;
    }

    // --- 4. 선택 실패 함수 ---
    function failSelection() {
        selectedApples.forEach($el => $el.removeClass('selected'));
        selectedApples = [];
        currentSum = 0;
        isDragging = false;
    }

    // --- 5. 게임 시작/리셋 함수 ---
    $startGameBtn.on('click', startGame);
    
    function startGame() {
        if (isPlaying) return; 
        console.log("게임 시작!");
        isPlaying = true;

        score = 0;
        timer = 60; 
        $scoreDisplay.text(score);
        $timerDisplay.text(timer);
        
        $overlay.addClass('hidden'); // 오버레이 숨기기
        
        resetBoard(); // 판 리셋 (초기화)

        gameInterval = setInterval(gameLoop, 1000);
    }

    // 판 리셋 함수 (100개 새로 생성)
    function resetBoard() {
        $board.empty(); // 게임판 비우기
        createApples(100);
    }

    // --- 6. 1초마다 실행되는 게임 루프 ---
    function gameLoop() {
        timer--;
        $timerDisplay.text(timer);

        if (timer <= 0) {
            gameOver();
        }
    }

    // --- 7. 사과 생성 함수 (블루 애플 로직) ---
    function createApples(count) {
        for (let i = 0; i < count; i++) {
            const number = Math.floor(Math.random() * 9) + 1; // 1-9
            const $apple = $('<div></div>')
                .addClass('apple')
                .text(number)
                .data('value', number); 
            
            // 5% 확률로 파란 사과 적용
            if (Math.random() < BLUE_APPLE_CHANCE) {
                $apple.addClass('apple-blue'); // 파란 사과 CSS 적용
                $apple.data('isBlue', true);   // 파란 사과 데이터 저장
            } else {
                $apple.data('isBlue', false);
            }
            
            $board.append($apple);
        }
    }

    // --- 8. 게임 오버 함수 (백엔드 연동) ---
    function gameOver() {
        console.log("게임 오버! 최종 점수:", score);
        clearInterval(gameInterval); 
        isPlaying = false; 
        isDragging = false;
        
        // 오버레이에 게임 오버 메시지 표시
        $gameMessage.html(`게임 오버!<br>최종 점수: ${score}`);
        $startGameBtn.text("다시 시작");
        $overlay.removeClass('hidden'); // 오버레이 표시

        // app.js의 submitScore() 함수를 호출하여 점수를 전송
        if (typeof submitScore === 'function') {
            if (score > 0) {
                console.log(`score-api(${SCORE_API_URL})로 점수(${score}) 전송 시도...`);
                submitScore(score); 
            } else {
                console.log("0점이므로 랭킹을 전송하지 않습니다.");
            }
        }
    }

    // --- 9. (신규) 게임 시작 전 설명 표시 ---
    function showInstructions() {
        $gameMessage.html(`
            <h4 style="color:#333;">변형 사과 게임</h4>
            <ul class="text-left small" style="list-style-position: inside;">
                <li>사과를 드래그하여 연결하세요.</li>
                <li>숫자의 합이 <strong>정확히 10</strong>이 되면 점수를 얻습니다.</li>
                <li>점수는 <strong>연결한 사과 1개당 1점</strong>입니다. (예: 3+7 = 2점)</li>
                <li><strong style="color:blue;">파란 사과</strong>를 포함해 10을 만들면,<br>점수를 얻고 <strong>판이 리셋</strong>됩니다!</li>
            </ul>
        `);
        $overlay.removeClass('hidden'); // 오버레이 보이기
    }
    
    showInstructions(); // 페이지 로드 시 설명 표시

}); // (document).ready 끝