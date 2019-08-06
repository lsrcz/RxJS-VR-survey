import { Action } from './Action';
import { Todo } from '@/models';

export class ToggleAllAction extends Action {
    constructor() {
        super();
    }
    public doAction(todos: Todo[]) {
        const ret: Todo[] = [];
        if (todos.filter((todo: Todo) => todo.completed).length === todos.length) {
            todos.forEach((todo: Todo) => {
                ret.push({...todo, completed: false});
            });
        } else {
            todos.forEach((todo: Todo) => {
                ret.push({...todo, completed: true});
            });
        }
        return ret;
    }
}

