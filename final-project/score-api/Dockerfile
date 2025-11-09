# 1. 기본 이미지: PHP 8.0 Apache 버전을 사용합니다.
FROM php:8.0-apache

# 2. PHP 확장 모듈 설치
RUN apt-get update && apt-get install -y zlib1g-dev libpng-dev \
    && docker-php-ext-install mysqli pdo pdo_mysql gd iconv opcache \
    && docker-php-ext-install sockets # <-- [수정] RabbitMQ에 필요한 'sockets' 확장 모듈 추가

# 3. Redis 확장 모듈 설치
RUN pecl install redis && docker-php-ext-enable redis

# 4. Composer (PHP 패키지 매니저) 설치 ---
RUN apt-get install -y curl unzip
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# 5.  Composer 의존성 설치 ---
COPY composer.json .

# 'sockets' 확장 설치
RUN composer install --no-dev --optimize-autoloader