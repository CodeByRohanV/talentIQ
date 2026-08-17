git fetch gitlab
git checkout -B temp-sync gitlab/main
git rm -rf .
git checkout main -- .
git add .
git restore --staged frontend/.env server/.env
git checkout HEAD -- frontend/.env server/.env
git commit -m "sync: bring all local fixes to gitlab main"
git push gitlab temp-sync:main
git checkout main
