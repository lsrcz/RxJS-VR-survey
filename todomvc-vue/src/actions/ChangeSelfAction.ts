import { Action } from './Action';
import { Todo } from '@/models';

export class ChangeSelfAction extends Action {
    private readonly index: number;
    private readonly msg: string;
    constructor(index: number, msg: string) {
        super();
        this.index = index;
        this.msg = msg;
    }
    public doAction(todos: Todo[]) {
        const current = todos[this.index];
        return [...todos.slice(0, this.index),
        { ...current, title: this.msg },
        ...todos.slice(this.index + 1)];
    }
}

