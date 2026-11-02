#!/bin/bash
for i in $(seq 1 120); do
  ap=$(adb shell "dumpsys wifi 2>/dev/null | grep -o 'frequency= [0-9]*' | head -1" 2>/dev/null | tr -d '\r')
  link=$(iw dev wlo1 link 2>/dev/null | awk '/freq/{print $2}' | cut -d. -f1)
  ip=$(ip -4 -br addr show wlo1 2>/dev/null | awk '{print $3}')
  echo "$(date +%H:%M:%S) ap:$ap laptop_freq:${link:-down} ip:${ip:-none}"
  sleep 5
done
