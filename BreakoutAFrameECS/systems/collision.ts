/// <reference types="@types/aframe"/>

import { withLatestFrom, share, filter, map, tap } from "rxjs/operators";
import { COLLIDE_DIR } from "../interface";

AFRAME.registerSystem('collision', {
    init() {
        const messageSystem = this.el.sceneEl.systems.message;
        const ball = messageSystem.getStream('ball-pos');
        const paddle = messageSystem.getStream('paddle-pos');
        const bricks = messageSystem.getStream('bricks');
        const balldir = messageSystem.getStream('ball-dir');

        const cPaddleProvider = ball.pipe(
            filter(({z}) => z > 9),
            withLatestFrom(paddle),
            filter(([{x, z}, ppos]) => x > ppos - 3),
            filter(([{x, z}, ppos]) => x < ppos + 3),
            map(e => true),
            share()
        );
        const cGroundProvider = ball.pipe(
            filter(({z}) => z > 9),
            withLatestFrom(paddle),
            filter(([{x, z}, pos]) => {
                return x < pos - 3 || x > pos + 3
            }),
            map(e => true),
            share()
        );
        const cWallProvider = ball.pipe(
            filter(({x}) => x < -12.5 || x > 12.5),
            map(e => true),
            share()
        );
        const cCeilingProvider = ball.pipe(
            filter(({z}) => z < -9.5),
            map(e => true),
            share()
        );
        function collision(brick, balldir, ball): COLLIDE_DIR {
            const brickPosition = brick.getAttribute('position');
            const brickWidth = brick.getAttribute('width');
            const brickDepth = brick.getAttribute('depth');
            const distance = (brickWidth - brickDepth) / 2;
            const z1 = Math.abs(ball.z - brickPosition.z);
            const x1 = Math.abs(ball.x - brickPosition.x) - distance;
            if (2 * z1 > brickDepth || 2 * x1 > brickWidth) {
                return COLLIDE_DIR.NO;
            }

            if (x1 > z1) {
                if (balldir.x > 0) {
                    return COLLIDE_DIR.LEFT;
                } else {
                    return COLLIDE_DIR.RIGHT;
                }
            } else {
                if (balldir.z > 0) {
                    return COLLIDE_DIR.UP;
                } else {
                    return COLLIDE_DIR.DOWN;
                }
            }
        }
        function isCollidedBrick(bricks: any[], balldir, ball): {idx: number, dir: COLLIDE_DIR} {
            for (let i = 0; i < bricks.length; ++i) {
                const dir = collision(bricks[i], balldir, ball);
                if (dir != COLLIDE_DIR.NO) {
                    return {idx: i, dir: dir};
                }
            }
            return {idx: -1, dir: COLLIDE_DIR.NO};
        }
        const cBrickProvider = ball.pipe(
            withLatestFrom(balldir),
            withLatestFrom(bricks),
            map(([[ball, dir], bricks]) => {
                return isCollidedBrick(bricks, dir, ball);
            }),
            filter(({idx}) => idx != -1),
            tap(console.log),
            share()
        )
        messageSystem.provideToBus('cpaddle', cPaddleProvider);
        messageSystem.provideToBus('cground', cGroundProvider);
        messageSystem.provideToBus('cwall', cWallProvider);
        messageSystem.provideToBus('cceiling', cCeilingProvider);
        messageSystem.provideToBus('cbrick', cBrickProvider);
    }
})