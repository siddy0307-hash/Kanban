pipeline {
    agent any

    environment {
        PATH = "/usr/local/bin:/opt/homebrew/bin:${env.PATH}"
        CI = "true"
        GHCR_IMAGE = "ghcr.io/siddy0307-hash/kanban-frontend"
    }

    options {
        skipDefaultCheckout(true)
        timestamps()
        disableConcurrentBuilds(abortPrevious: true)
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 20, unit: 'MINUTES')
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Prepare Build Information') {
            steps {
                script {
                    env.IMAGE_TAG = sh(
                        script: 'git rev-parse --short=12 HEAD',
                        returnStdout: true
                    ).trim()

                    echo "Branch: ${env.BRANCH_NAME}"
                    echo "Commit: ${env.IMAGE_TAG}"

                    if (env.CHANGE_ID) {
                        echo "Pull Request: ${env.CHANGE_ID}"
                    }
                }
            }
        }

        stage('Verify Tooling') {
            steps {
                sh '''
                    echo "Node version:"
                    node --version

                    echo "npm version:"
                    npm --version

                    echo "Docker version:"
                    docker --version

                    echo "kubectl version:"
                    kubectl version --client
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

                    test -n "$(
                        find build/static/js \
                            -name 'main.*.js' \
                            -print \
                            -quit
                    )"

                    test -n "$(
                        find build/static/css \
                            -name 'main.*.css' \
                            -print \
                            -quit
                    )"

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

        stage('Build Docker Image') {
            steps {
                sh '''
                    docker build \
                        --label org.opencontainers.image.source=https://github.com/siddy0307-hash/Kanban \
                        --tag "$GHCR_IMAGE:$IMAGE_TAG" \
                        .
                '''
            }
        }

        stage('Push Docker Image to GHCR') {
            when {
                branch 'main'
            }

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

                        docker tag \
                            "$GHCR_IMAGE:$IMAGE_TAG" \
                            "$GHCR_IMAGE:latest"

                        docker push "$GHCR_IMAGE:$IMAGE_TAG"
                        docker push "$GHCR_IMAGE:latest"
                    '''
                }
            }
        }

        stage('Deploy to Kubernetes') {
            when {
                branch 'main'
            }

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

        stage('Verify Kubernetes Deployment') {
            when {
                branch 'main'
            }

            steps {
                sh '''
                    EXPECTED_IMAGE="$GHCR_IMAGE:$IMAGE_TAG"

                    ACTUAL_IMAGE="$(
                        kubectl --context docker-desktop \
                            get deployment kanban-frontend \
                            -o jsonpath='{.spec.template.spec.containers[?(@.name=="frontend")].image}'
                    )"

                    echo "Expected image: $EXPECTED_IMAGE"
                    echo "Deployed image: $ACTUAL_IMAGE"

                    test "$ACTUAL_IMAGE" = "$EXPECTED_IMAGE"

                    kubectl --context docker-desktop \
                        get deployment kanban-frontend

                    kubectl --context docker-desktop \
                        get pods \
                        -l app=kanban-frontend

                    echo "Kubernetes deployment verified successfully."
                '''
            }
        }
    }

    post {
        success {
            script {
                if (env.BRANCH_NAME == 'main') {
                    echo 'Main pipeline completed successfully.'
                    echo 'Docker image was pushed to GHCR.'
                    echo 'Application was deployed to Kubernetes.'
                    echo "Image: ${env.GHCR_IMAGE}:${env.IMAGE_TAG}"
                } else if (env.CHANGE_ID) {
                    echo "Pull request ${env.CHANGE_ID} passed CI."
                    echo 'No image was pushed and no deployment was performed.'
                } else {
                    echo "Branch ${env.BRANCH_NAME} passed CI."
                    echo 'No image was pushed and no deployment was performed.'
                }
            }
        }

        failure {
            echo 'Pipeline failed. Check the failed stage logs.'
        }

        cleanup {
            echo 'Pipeline execution finished.'
        }
    }
}