FROM nginx

COPY static /var/www/

COPY conf /etc/nginx
