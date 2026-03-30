// Collision categories and filters ported from collision.lua

const CollisionCategory = {
    static: 1,
    staticSensor: 2,
    actors: 16,
    actorSensor: 32,
    objects: 256,
    objectSensor: 512,
    debris: 1024,
};

const CollisionFilter = {
    everything: 1 + 2 + 4 + 8 + 16 + 32 + 64 + 128 + 256 + 512 + 1024 + 2048,
    notActors: 1 + 2 + 4 + 8 + 256 + 512 + 1024 + 2048,
    actorsAndStatic: 1 + 16,
    debrisAndStatic: 1 + 1024,
};
