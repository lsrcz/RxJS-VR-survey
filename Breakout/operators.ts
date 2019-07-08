import { Observable, zip } from "rxjs";

import { map, pluck } from "rxjs/operators";

import { getDriverTick } from "./tick";

export function constant < T > (x: T): Observable < T > {
    return getDriverTick().pipe(
        map(e => x)
    );
}

export function lessThan(lhs: Observable < number > , rhs: Observable < number > ): Observable < boolean > {
    return zip(lhs, rhs).pipe(
        map(([l, r]) => l < r)
    );
}

export function equalTo(lhs: Observable < number > , rhs: Observable < number > ): Observable < boolean > {
    return zip(lhs, rhs).pipe(
        map(([l, r]) => l == r)
    );
}

export function and(lhs: Observable < boolean > , rhs: Observable < boolean > ): Observable < boolean > {
    return zip(lhs, rhs).pipe(
        map(([l, r]) => l && r)
    );
}

export function or(lhs: Observable < boolean > , rhs: Observable < boolean > ): Observable < boolean > {
    return zip(lhs, rhs).pipe(
        map(([l, r]) => l || r)
    );
}

export function not(input: Observable < boolean > ): Observable < boolean > {
    return input.pipe(map(e => !e));
}

export function ifOp<T1, T2>(pred: Observable < boolean >, thenv: Observable < T1 >, elsev: Observable < T2 >): Observable<T1|T2> {
    return zip(pred, thenv, elsev).pipe(
        map(([p, t, e]) => {
            if (p) {
                return t;
            } else {
                return e;
            }
        })
    )
}

export function add(lhs: Observable < number > , rhs: Observable < number > ): Observable < number > {
    return zip(lhs, rhs).pipe(
        map(([l, r]) => l + r)
    );
}

export function sub(lhs: Observable < number > , rhs: Observable < number > ): Observable < number > {
    return zip(lhs, rhs).pipe(
        map(([l, r]) => l - r)
    );
}

export function times(lhs: Observable < number > , rhs: Observable < number > ): Observable < number > {
    return zip(lhs, rhs).pipe(
        map(([l, r]) => l * r)
    );
}

export function map1 < T, R > (s: Observable < T > , f: (x: T) => R): Observable < R > {
    return s.pipe(
        map(f)
    );
}

export function map2 < T1, T2, R > (s1: Observable < T1 > , s2: Observable < T2 > , f: (x: T1, y: T2) => R): Observable < R > {
    return zip(s1, s2).pipe(
        map(([x, y]) => f(x, y)),
    );
}

export function map3 < T1, T2, T3, R > (s1: Observable < T1 > , s2: Observable < T2 > , s3: Observable < T3 > ,
    f: (x: T1, y: T2, z: T3) => R): Observable < R > {
    return zip(s1, s2, s3).pipe(
        map(([x, y, z]) => f(x, y, z))
    );
}

export function map4 < T1, T2, T3, T4, R > (s1: Observable < T1 > , s2: Observable < T2 > , s3: Observable < T3 > , s4: Observable < T4 > ,
    f: (x: T1, y: T2, z: T3, a: T4) => R): Observable < R > {
    return zip(s1, s2, s3, s4).pipe(
        map(([x, y, z, a]) => f(x, y, z, a))
    );
}

export function getField < T, K1 extends keyof T > (s: Observable < T > , k1: K1): Observable < T[K1] > {
    return s.pipe(
        pluck(k1)
    );
}
