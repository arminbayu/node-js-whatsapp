$(document).ready(function () {
    var socket = io();
    var dt = new Date();
    var date = dt.getDate() + "" + dt.getMonth() + "" + dt.getFullYear();
    var time = dt.getHours() + "" + dt.getMinutes() + "" + dt.getSeconds();
    var data = date + "" + time;
    const digest = sha256(data);
    $('#client-id').val(digest);

    $('.add-client-btn').click(function () {
        if ($('#device-name').val() != "" & $('#phone-number').val() != "" & $('#client-description').val() != "" & $('#master-code').val() == "12345678") {

            var deviceName = $('#device-name').val();
            var phoneNumber = $('#phone-number').val();
            var clientId = $('#client-id').val();
            var clientDescription = $('#client-description').val();

            var clientClass = 'client-' + clientId;
            var template = $('.client').first().clone()
                .removeClass('hide')
                .addClass(clientClass);

            template.find('.title').html(deviceName);
            template.find('.phone-number').html(phoneNumber);
            template.find('.client-id').html(clientId);
            template.find('.description').html(clientDescription);
            template.find('.logs').append($('<li>').text('Connecting...'));
            $('.client-container').append(template);

            socket.emit('create-session', {
                device_name: deviceName,
                phone_number: phoneNumber,
                client_id: clientId,
                description: clientDescription
            });
        } else {
            console.log("MASTER CODE WRONG");
        }
    });

    socket.on('init', function (data) {
        $('.client-container .client').not(':first').remove();
        for (var i = 0; i < data.length; i++) {
            var session = data[i];

            var deviceName = session.device_name;
            var phoneNumber = session.phone_number;
            var clientId = session.client_id;
            var clientDescription = session.description;

            var clientClass = 'client-' + clientId;
            var template = $('.client').first().clone()
                .removeClass('hide')
                .addClass(clientClass);

            template.find('.title').html(deviceName);
            template.find('.phone-number').html(phoneNumber);
            template.find('.client-id').html(clientId);
            template.find('.description').html(clientDescription);
            $('.client-container').append(template);

            if (session.ready) {
                $(`.client.${clientClass} .logs`).prepend($('<li>').text('Whatsapp is ready!'));
            } else {
                $(`.client.${clientClass} .logs`).prepend($('<li>').text('Connecting...'));
            }
        }
    });

    socket.on('remove-session', function (client_id) {
        $(`.client.client-${client_id}`).remove();
    });

    socket.on('message', function (data) {
        $(`.client.client-${data.client_id} .logs`).prepend($('<li>').text(data.text));
    });

    socket.on('qr', function (data) {
        $(`.client.client-${data.client_id} #qrcode`).attr('src', data.src);
        $(`.client.client-${data.client_id} #qrcode`).show();
    });

    socket.on('ready', function (data) {
        $(`.client.client-${data.client_id} #qrcode`).hide();
    });

    socket.on('authenticated', function (data) {
        $(`.client.client-${data.client_id} #qrcode`).hide();
    });
});