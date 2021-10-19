class EventEmitter {

    results = {};
    listeners = {};

    async fire(event) {
        for (var id in this.listeners) {
            let listener = this.listeners[id];
            this.unregister(id);

            const result = await listener();

            this.results[id] = {
                status: 'Finished',
                result
            }
        }
    }

    register(id, listener) {
        this.listeners[id] = listener;
        this.results[id] = {
            status: 'Pending',
            result: {}
        }
    }

    unregister(id) {
        return delete this.listeners[id];
    }

    getEvent(id) {
        return this.results[id];
    }
}

module.exports = EventEmitter;