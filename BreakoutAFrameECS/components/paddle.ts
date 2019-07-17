/// <reference types="@types/aframe"/>

import {
    merge,
    fromEvent
} from "rxjs";

import {
    map,
    startWith,
    distinctUntilChanged,
    share,
    withLatestFrom,
    scan,
    tap
} from "rxjs/operators";

AFRAME.registerComponent('paddle', {
    schema: {
        start: {
            type: "number"
        },
        left: {
            type: "number"
        },
        right: {
            type: "number"
        }
    },
    init() {
        if (this.el.sceneEl.hasLoaded) {
            this.initBody();
        } else {
            this.el.sceneEl.addEventListener('loaded', this.initBody.bind(this));
        }
    },
    initBody() {
        const tick = this.el.sceneEl.systems['message'].getStream('global-tick');
        const keydown = this.el.sceneEl.systems['message'].getStream('keydown');
        const keyup = this.el.sceneEl.systems['message'].getStream('keyup');
        console.log("inited")

        const paddleDir = merge(
            keydown.pipe(
                map(e => {
                    switch (e) {
                        case 74:
                            return -1;
                        case 75:
                            return 1;
                        default:
                            return 0;
                    }
                })
            ),
            keyup.pipe(
                map((e) => 0)
            )
        ).pipe(
            startWith(0),
            distinctUntilChanged(),
            share()
        );
        this.paddlePos = tick.pipe(
            withLatestFrom(paddleDir),
            map(([_, b]) => b),
            startWith(this.data.start),
            scan((position: number, dir) => {
                let next = position + dir * 0.3;
                return Math.min(Math.max(next, this.data.left), this.data.right);
            }),
            share(),
            distinctUntilChanged()
        );
        this.updateSubscription = this.paddlePos.subscribe(e => this.el.getAttribute('position').x = e);
        this.providerSubscription = this.el.sceneEl.systems['message'].provideToBus('paddle-pos', this.paddlePos);
    },
    remove() {
        this.updateSubscription.unsubscribe();
        this.providerSubscription.unsubscribe();
    },
    getPaddlePosStream() {
        return this.paddlePos;
    }
})