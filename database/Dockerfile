FROM mysql:8.4

# UTF-8 em tudo (acentos e ç): servidor, criação do banco e terminal mysql
COPY conf/utf8mb4.cnf /etc/mysql/conf.d/utf8mb4.cnf
COPY init/ /docker-entrypoint-initdb.d/
