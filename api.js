const express = require('express');
const fs = require('fs-extra');
const readline = require('readline');

const EventEmitter = require('./EventEmitter');

const app = express();
const eventEmitter = new EventEmitter();

function isAuthorized(req, res, next) {
    const auth = req.headers.authorization;
    let token = '';

    if (auth && auth.includes('bearer')) {
        token = auth.split(" ")[1].trim();
    }

    if (token === 'dGhlc2VjcmV0dG9rZW4=') {
        next();
    } else {
        res.status(401);
        res.send('Unauthorized');
    }
}

async function getAddresses() {
    const addresses = await fs.readFileSync('./addresses.json');
    return JSON.parse(addresses);
};

function getDistanceBetweenCoordinates(coord_1, coord_2) {
    const lat1 = coord_1.latitude;
    const lat2 = coord_2.latitude;
    const lon1 = coord_1.longitude;
    const lon2 = coord_2.longitude;

    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres
    return Math.round((d / 1000) * 100) / 100;
}

async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    }).catch(function () { });
}

async function main() {
    while (true) {
        const waitTimeMS = Math.floor(Math.random() * 10000);
        await sleep(waitTimeMS);
        await eventEmitter.fire({ time: waitTimeMS });
    }
}

async function getCities(fromGuid, distance) {
    const allAddresses = await getAddresses();

    const fromCity = allAddresses.filter((address) => {
        return address.guid === fromGuid;
    })

    if (!fromCity.length) {
        return response.status(404);
    }

    const from = fromCity[0];

    const cities = [];

    allAddresses.forEach(to => {
        if (getDistanceBetweenCoordinates(from, to) < distance && from !== to) {
            cities.push(to);
        }
    });

    const result = {
        cities
    }

    return result;
}

const server = app.listen(8080, () => {
    var host = server.address().address
    var port = server.address().port

    host = host === '::' ? '127.0.0.1' : host;
    console.log("Api is listening at http://%s:%s", host, port);
    main();
});

app.get('/cities-by-tag', isAuthorized, async (request, response) => {
    const tag = request.query.tag;
    const isActive = request.query.isActive;
    const allAddresses = await getAddresses();

    const cities = allAddresses.filter((address) => {
        return address.isActive == JSON.parse(isActive) && address.tags.includes(tag);
    });

    response.json({
        cities,
        length: cities.length
    });
})

app.get('/distance', isAuthorized, async (request, response) => {
    const fromGuid = request.query.from;
    const toGuid = request.query.to;

    const allAddresses = await getAddresses();

    const fromCity = allAddresses.filter((address) => {
        return address.guid === fromGuid;
    })

    const toCity = allAddresses.filter((address) => {
        return address.guid === toGuid;
    })

    if (!fromCity.length || !toCity.length) {
        return response.status(404);
    }

    const from = fromCity[0];
    const to = toCity[0];

    const distance = getDistanceBetweenCoordinates(from, to);

    response.json({
        from,
        to,
        unit: 'km',
        distance
    });
})

app.get('/area', isAuthorized, async (request, response) => {
    const uuid = '2152f96f-50c7-4d76-9e18-f7033bd14428';

    const fromGuid = request.query.from;
    const distance = request.query.distance;

    const handler = async () => {
        return await getCities(fromGuid, distance);
    };

    eventEmitter.register(uuid, handler);

    timer = setTimeout(function () {
        response.status(202);
        response.json({
            resultsUrl: `http://127.0.0.1:8080/area-result/${uuid}`
        })
        response.end();
    }, 15);

    const event = eventEmitter.getEvent(uuid);

    if (event.status === 'Finished') {
        response.status(200);
        response.json(event);
        response.end();
    }
})

app.get('/area-result/:id', isAuthorized, async (request, response) => {
    const uuid = request.params.id;

    const event = eventEmitter.getEvent(uuid);

    const status = event.status === 'Pending' ? 202 : 200;

    response.status(status);
    response.json(event.result);
    response.end();
})

app.get('/all-cities', isAuthorized, async (request, response, next) => {
    response.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked'
    })

    const fileStream = fs.createReadStream('./addresses.json');

    const readInterface = readline.createInterface({
        input: fileStream
    });

    for await (const line of readInterface) {
        response.write(line);
    }

    response.end()
    next();
})