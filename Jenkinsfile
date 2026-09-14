pipeline {
    agent any

    environment {
        PATH = "/usr/local/bin:/opt/homebrew/bin:${env.PATH}"
        CI = "true"
        PUBLIC_URL = "/Kanban"
        GHCR_IMAGE = "ghcr.io/siddy0307-hash/kanban-frontend"
    }

    triggers {
        // Jenkins checks GitHub approximately every two minutes.
        pollSCM('H/2 * * * *')
    }

    options {
        skipDefaultCheckout(true)
        timestamps()
        disableConcurrentBuilds(abortPrevious: true)
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
         stage('Checkout Code') {
            steps {
                checkout scm
            }
        }
        stage('Checkout Code') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/siddy0307-hash/Kanban.git'
            }
        }

        stage('Verify Tooling') {
            steps {
                sh '''
                    echo "Node version:"
                    node --version

                    echo "npm version:"
                    npm --version
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Run Tests') {
            steps {
                sh 'npm test -- --watchAll=false'
            }
        }

        stage('Run Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Verify and Archive Build') {
            steps {
                sh '''
                    test -s build/index.html
                    test -n "$(find build/static/js -name 'main.*.js' -print -quit)"
                    test -n "$(find build/static/css -name 'main.*.css' -print -quit)"

                    echo "Production build verified successfully."
                    du -sh build
                '''

                archiveArtifacts(
                    artifacts: 'build/**',
                    fingerprint: true,
                    onlyIfSuccessful: true
                )
            }
        }
        
        stage('Verify Docker') {
    steps {
        sh '''
            docker --version
            docker compose version
        '''
    }
}

stage('Build Docker Image') {
    steps {
        script {
            env.IMAGE_TAG = sh(
                script: 'git rev-parse --short HEAD',
                returnStdout: true
            ).trim()
        }

        sh '''
            docker build \
                --label org.opencontainers.image.source=https://github.com/siddy0307-hash/Kanban \
                --tag "$GHCR_IMAGE:$IMAGE_TAG" \
                --tag "$GHCR_IMAGE:latest" \
                .
        '''
    }
}

stage('Push Docker Image to GHCR') {
    steps {
        withCredentials([
            usernamePassword(
                credentialsId: 'github-container-registry',
                usernameVariable: 'GHCR_USERNAME',
                passwordVariable: 'GHCR_TOKEN'
            )
        ]) {
            sh '''
                trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

                printf '%s' "$GHCR_TOKEN" |
                    docker login ghcr.io \
                        --username "$GHCR_USERNAME" \
                        --password-stdin

                docker push "$GHCR_IMAGE:$IMAGE_TAG"
                docker push "$GHCR_IMAGE:latest"
            '''
        }
    }
}

stage('Deploy to Kubernetes') {
    steps {
        sh '''
            kubectl --context docker-desktop set image \
                deployment/kanban-frontend \
                frontend="$GHCR_IMAGE:$IMAGE_TAG"

            kubectl --context docker-desktop rollout status \
                deployment/kanban-frontend \
                --timeout=120s
        '''
    }
}

stage('Deploy Docker Container') {
    steps {
        sh '''
            docker compose -p kanban-board up \
                -d \
                --no-build \
                --force-recreate \
                frontend
        '''
    }
}

stage('Verify Docker Deployment') {
    steps {
        sh '''
            SUCCESS=false

            for ATTEMPT in 1 2 3 4 5 6 7 8 9 10
            do
                if curl --fail --silent http://localhost:3001/health
                then
                    SUCCESS=true
                    break
                fi

                sleep 2
            done

            if [ "$SUCCESS" != "true" ]
            then
                docker compose -p kanban-board logs frontend
                exit 1
            fi

            echo "Docker deployment is healthy."
            docker compose -p kanban-board ps
        '''
    }
}

        stage('Deploy to GitHub Pages') {
            steps {
                withCredentials([
                    gitUsernamePassword(
                        credentialsId: '1551179d-6bfb-4088-8aa1-85c56d97ce4f',
                        gitToolName: 'Default'
                    )
                ]) {
                    sh '''
                        DEPLOY_DIR="$(mktemp -d)"
                        trap 'rm -rf "$DEPLOY_DIR"' EXIT

                        cp -R build/. "$DEPLOY_DIR/"
                        touch "$DEPLOY_DIR/.nojekyll"

                        cd "$DEPLOY_DIR"

                        git init
                        git checkout -b gh-pages
                        git config user.name "Jenkins"
                        git config user.email "jenkins@localhost"

                        git add .
                        git commit -m "Deploy Jenkins build ${BUILD_NUMBER}"

                        git remote add origin https://github.com/siddy0307-hash/Kanban.git
                        git push --force origin gh-pages
                    '''
                }
            }
        }
    } 

    post {
        success {
            echo 'CI/CD pipeline completed successfully.'
            echo 'Build artifacts are available in Jenkins.'
            echo 'Application deployed to GitHub Pages.'
            echo 'URL: https://siddy0307-hash.github.io/Kanban/'
        }

        failure {
            echo 'Pipeline failed. Check the failed stage logs.'
        }

        cleanup {
            echo 'Pipeline execution finished.'
        }
    }
}