#!/bin/bash

name="score-counter-service"

echo -e "\033[34m\n\nUsing nvm...\033[0m"
nvm use;

echo -e "\033[34m\n\nInstalling web dependencies...\033[0m"
cd ./web && npx pnpm i && pnpm build && cd ..;

echo -e "\033[34m\n\nInstalling service dependencies...\033[0m"
cd ./service && npx pnpm i && npx tsc && cd ..;

echo -e "\033[34m\n\nStarting service...\033[0m"
npx pm2 delete $name;
npx pm2 start ./service/dist/main.js --name $name --interpreter $(which node)