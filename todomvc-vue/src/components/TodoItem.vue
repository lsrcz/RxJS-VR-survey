<template>
  <li :class="{ completed: todo.completed, editing: editing }">
    <div class="view">
      <input
        class="toggle"
        type="checkbox"
        v-bind:checked="todo.completed"
        @change="$emit('toggleCompleted')"
      />
      <label v-stream:dblclick="startEdit$">{{todo.title}}</label>
      <button class="destroy" v-stream:click="destroy$"></button>
    </div>
    <input
      class="edit"
      type="text"
      v-bind:value="inputVal"
      v-todo-focus="editing"
      v-stream:blur="blur$"
      v-stream:keyup="keyup$"
      v-stream:input="input$"
    />
  </li>
</template>

<script lang="ts">
import { Todo } from '../models';
import { Component, Prop, Vue } from 'vue-property-decorator';
import { Subject, merge, ReplaySubject, BehaviorSubject } from 'rxjs';
import { mapTo, filter, startWith, withLatestFrom, map, pluck, tap, distinctUntilChanged, delay } from 'rxjs/operators';

@Component<TodoItem>({
  directives: {
    'todo-focus'(el, binding) {
      if (binding.value) {
        el.focus();
      }
    },
  },
  subscriptions() {
    const doneEdit$ = merge(
      this.blur$,
      this.keyup$.pipe(filter(({ event }) => event.keyCode === 13)),
    );
    const cancelEdit$ = this.keyup$.pipe(
      filter(({ event }) => event.keyCode === 27),
    );
    const editing$ = merge(
      this.startEdit$.pipe(mapTo(true)),
      doneEdit$.pipe(mapTo(false)),
      cancelEdit$.pipe(mapTo(false)),
    );

    const inputVal$ = merge(
      this.input$.pipe(
        pluck('event'),
        map((e: InputEvent) => (e.srcElement! as HTMLInputElement).value),
      ),
      cancelEdit$.pipe(
        withLatestFrom(this.todo$),
        map(([_, todo]) => todo.title),
      ),
      this.todo$.pipe(
        map((todo: Todo) => todo.title),
      ),
    );
    const newVal$ = doneEdit$.pipe(
      withLatestFrom(inputVal$),
      map(([_, snd]) => snd),
      map((s: string) => s && s.trim()),
    );
    const destroySelf$ = merge(
      this.destroy$,
      newVal$.pipe(
        filter((e) => !Boolean(e)),
      ),
    );
    const updateSelf$ = newVal$.pipe(
      filter(Boolean),
    );
    return {
      editing: editing$,
      doneEdit: doneEdit$,
      inputVal: inputVal$,
      updateSelf: updateSelf$,
      destroySelf: destroySelf$,
    };
  },
})
export default class TodoItem extends Vue {
  private beforeEditCache = '';

  @Prop() private readonly todo!: Todo;

  private startEdit$: Subject<any> = new Subject();
  private blur$: Subject<any> = new Subject();
  private keyup$: Subject<{ event: KeyboardEvent }> = new Subject();
  private input$: Subject<{ event: InputEvent }> = new Subject();
  private destroy$: Subject<{ event: MouseEvent }> = new Subject();

  private todo$: Subject<Todo> = new ReplaySubject(1);

  private mounted() {
    this.$subscribeTo(
      this.$observables.updateSelf.pipe(),
      (str) => this.$emit('changeSelf', str),
    );
    this.$subscribeTo(
      this.$observables.destroySelf.pipe(),
      (str) => this.$emit('removeSelf'),
    );
    this.$subscribeTo(
      this.$watchAsObservable('todo').pipe(
        pluck('newValue'),
        startWith(this.todo),
        delay(0),
      ),
      (e) => this.todo$.next(e),
    );
  }

}
</script>