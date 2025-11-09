# 1. 기본 이미지: Python 3.11 경량 버전을 사용
FROM python:3.11-slim

# 2. 작업 디렉토리 설정
WORKDIR /app

# 3. 의존성 파일 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. 컨테이너 실행 명령어
# (API 서버가 아닌, worker.py 스크립트를 직접 실행)
CMD ["python", "worker.py"]