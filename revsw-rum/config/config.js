module.exports = {
        service: {
                url: "0.0.0.0",
                https_port:443,
                http_port:80,
                nonce_validate_time:100,
                nonce: false
        },
        use_x_forwarded_for:true,
        is_multiple_collectors: false,
        is_https: true,
        process_res_timing: true,
        request_uuid: true,
        winston_syslog_level:"warn",
        key_path : '/opt/revsw-rum/config/ssl_certs/server.key',
        cert_path : '/opt/revsw-rum/config/ssl_certs/server.crt',
        ca_path : '/opt/revsw-rum/config/ssl_certs/ca_chain.crt',
        cube:[{
                protocol:"ws",domain:"TESTSJC20-CUBE01.REVSW.NET",port:"1080", client : null
        }]
};


