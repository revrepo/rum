module.exports = {
        service: {
                url: "0.0.0.0",
                https_port:444,
                http_port:81,
                nonce_validate_time:100,
                nonce: false
        },
        use_x_forwarded_for:true,
        is_multiple_collectors: false,
        is_https: true,
        process_res_timing: true,
        request_uuid: true,
        key_path : './config/ssl_certs/server.key',
        cert_path : './config/ssl_certs/server.crt',
        ca_path : './config/ssl_certs/ca_chain.crt',
        cube:[{
                protocol:"ws",domain:"localhost",port:"1080", client : null
        }],

	logging: {
                syslog_level:"debug", // allowed levels debug, info, notice, warning, error, crit, alert, emerg
                debug_log_file_path:"./log/rum.log"
        }
};


