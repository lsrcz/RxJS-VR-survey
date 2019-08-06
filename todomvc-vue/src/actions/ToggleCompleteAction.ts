import { Action } from './Action';
import { Todo } from '@/models';

export class ToggleCompleteAction extends Action {
    private readonly index: number;
    constructor(index: number) {
        super();
        this.index = index;
    }
    public doAction(todos: Todo[]) {
        const current = todos[this.index];
        return [...todos.slice(0, this.index),
        { ...current, completed: !current.completed },
        ...todos.slice(this.index + 1)];
    }
}

