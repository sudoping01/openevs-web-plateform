FROM eclipse-mosquitto:2.0.20

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
COPY mosquitto.conf /mosquitto/config/mosquitto.conf

RUN touch /mosquitto/config/pwfile && \
    chown mosquitto:mosquitto /mosquitto/config/pwfile && \
    chmod 600 /mosquitto/config/pwfile

ENTRYPOINT ["/entrypoint.sh"]
