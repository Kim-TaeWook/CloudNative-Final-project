# 1. 기본 이미지: PHP 8.0 Apache 버전을 사용합니다.
FROM php:8.0-apache

# 2. PHP 확장 모듈 설치 (MySQL, GD 등)
RUN apt-get update && apt-get install -y zlib1g-dev libpng-dev \
    && docker-php-ext-install mysqli pdo pdo_mysql gd iconv opcache

# 3. Redis 확장 모듈 설치 (세션 공유용)
RUN pecl install redis && docker-php-ext-enable redis