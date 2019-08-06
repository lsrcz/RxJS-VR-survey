import { Action } from './Action';
import { Todo } from '@/models';

export class ClearCompletedAction extends Action {
    constructor() {
        super();
    }
    public doAction(todos: Todo[]) {
        const ret: Todo[] = [];
        todos.forEach((todo: Todo) => {
            if (!todo.completed) {
                ret.push(todo);
            }
        });
        return ret;
    }
}

