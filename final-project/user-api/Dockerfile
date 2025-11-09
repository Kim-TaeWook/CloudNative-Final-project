# 1. 기본 이미지: Python 3.11 경량 버전을 사용합니다.
FROM python:3.11-slim

# 2. 작업 디렉토리: 컨테이너 내부의 /app 폴더를 기본 경로로 설정합니다.
WORKDIR /app

# 3. 의존성 설치: requirements.txt를 먼저 복사하고 설치합니다.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. 포트 개방: FastAPI 서버가 80번 포트에서 실행될 것을 알립니다.
EXPOSE 80

# 5. 컨테이너 실행 명령어: uvicorn을 사용해 main.py의 app을 실행합니다.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80"]