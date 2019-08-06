<template>
  <footer class="footer">
    <!-- This should be `0 items left` by default -->
    <span class="todo-count">
      <strong>{{itemsLeft}}</strong>
      {{itemSingularOrPlural}} left
    </span>
    <!-- Remove this if you don't implement routing -->
    <ul class="filters">
      <li>
        <router-link to="/" :class="{ selected: !isActive && !isCompleted }">All</router-link>
      </li>
      <li>
        <router-link to="/active" :class="{ selected: isActive }">Active</router-link>
      </li>
      <li>
        <router-link to="/completed" :class="{ selected: isCompleted }">Completed</router-link>
      </li>
    </ul>
    <!-- Hidden if no completed items are left ↓ -->
    <button class="clear-completed" @click="$emit('clearCompleted')">Clear completed</button>
  </footer>
</template>

<script lang="ts">
import { map, pluck } from 'rxjs/operators';
import { Subject, BehaviorSubject } from 'rxjs';
import { Component, Vue, Prop } from 'vue-property-decorator';

@Component<TodoFooter>({
  subscriptions() {
    return {
      isActive: this.currentView$.pipe(map((e) => e === 'active')),
      isCompleted: this.currentView$.pipe(map((e) => e === 'completed')),
      itemSingularOrPlural: this.itemsLeft$.pipe(map((e) => e === 1 ? 'item' : 'items')),
    };
  },
})
export default class TodoFooter extends Vue {
  @Prop(Number) private readonly itemsLeft!: number;
  @Prop(String) private readonly currentView!: string;
  private itemsLeft$ = new BehaviorSubject(this.itemsLeft);
  private currentView$ = new BehaviorSubject(this.currentView);

  private mounted() {
    this.$subscribeTo(
      this.$watchAsObservable('currentView').pipe(pluck('newValue')),
      (e) => this.currentView$.next(e),
    );
    this.$subscribeTo(
      this.$watchAsObservable('itemsLeft').pipe(pluck('newValue')),
      (e) => this.itemsLeft$.next(e),
    );
  }
}
</script>