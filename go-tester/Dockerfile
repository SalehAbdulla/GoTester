# syntax=docker/dockerfile:1
FROM golang:1.22

WORKDIR /app

COPY go.mod .
RUN go mod download

COPY tests ./tests

RUN mkdir -p student/piscine && adduser --disabled-password --gecos "" runner
USER runner

RUN printf '#!/bin/sh\nset -e\n: "${RUN_REGEX:=.}"\nGOFLAGS="-count=1" go test ./... -run "$RUN_REGEX" -v -timeout=30s\n' > /usr/local/bin/run-tests && chmod +x /usr/local/bin/run-tests

CMD ["sh","-lc","run-tests"]
