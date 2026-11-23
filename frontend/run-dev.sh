#!/usr/bin/env bash
cd /home/saiful/projects/income-expense/frontend
while true; do
  ./node_modules/.bin/next dev -H 0.0.0.0 -p 18000
  echo "[run-dev] Next dev exited. Restarting in 1s..."
  sleep 1
done
