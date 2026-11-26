#!/bin/sh
# Flame المستقل — تشغيل بأمر واحد (من غير أي تثبيت: السيرفر بدون مكتبات خارجية)
# Usage: ./start.sh
# ثم افتح http://localhost:3000
cd "$(dirname "$0")"
exec node server.js
