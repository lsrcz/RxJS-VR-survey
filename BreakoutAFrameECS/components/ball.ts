/// <reference types="@types/aframe" />
import {
    fromEvent,
    Subject,
    merge
} from "rxjs";
import {
    startWith,
    map,
    scan,
    withLatestFrom,
    share,
    tap,
    filter
} from "rxjs/operators";
import {
    COLLIDE_DIR
} from "../interface";

AFRAME.registerComponent('ball', {
    init() {
        if (this.el.sceneEl.hasLoaded) {
            this.initBody();
        } else {
            this.el.sceneEl.addEventListener('loaded', this.initBody.bind(this));
        }
    },
    initBody() {

        const messageSystem = this.el.sceneEl.systems['message'];
        const ticker = messageSystem.getStream('global-tick');
        const cBricks = messageSystem.getStream('cbrick');
        const cPaddle = messageSystem.getStream('cpaddle');
        const cCeiling = messageSystem.getStream('cceiling');
        const cWall = messageSystem.getStream('cwall');

        this.ballDir = merge(
            merge(cBricks.pipe(
                    filter(({
                        dir
                    }) => dir == COLLIDE_DIR.DOWN || dir == COLLIDE_DIR.UP)
                ),
                cPaddle,
                cCeiling
            ).pipe(map(e => {
                return {
                    x: 1,
                    z: -1
                };
            })),
            merge(cBricks.pipe(
                    filter(({
                        dir
                    }) => dir == COLLIDE_DIR.RIGHT || dir == COLLIDE_DIR.LEFT)
                ),
                cWall
            ).pipe(map(e => {
                return {
                    x: -1,
                    z: 1
                };
            }))
        ).pipe(
            startWith({
                x: 0.1,
                z: 0.1
            }),
            scan(({
                x,
                z
            }, dxz) => {
                return {
                    x: x * dxz.x,
                    z: z * dxz.z
                };
            }),
            share()
        );

        interface Ball {
            x: number;
            z: number;
        }

        const initBall: Ball = {
            x: 0,
            z: 0
        };

        this.ballPosStream = ticker.pipe(
            withLatestFrom(this.ballDir),
            startWith(initBall),
            scan((position: Ball, [_, bdir]: Ball[]) => {
                const newBall = {
                    x: position.x + bdir.x,
                    z: position.z + bdir.z
                };
                return newBall;
            }),
            share()
        );

        messageSystem.provideToBus('ball-pos', this.ballPosStream);
        messageSystem.provideToBus('ball-dir', this.ballDir);
        this.ballPosStream.subscribe(e => {
            e.y = 0.5;
            this.el.setAttribute('position', e);
        });
    }
})