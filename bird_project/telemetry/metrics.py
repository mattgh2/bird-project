from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class Counter:
    name: str
    value: int = 0

    def increment(self, amount: int = 1) -> int:
        self.value += amount
        return self.value


@dataclass(slots=True)
class MetricsRegistry:
    counters: dict[str, Counter] = field(default_factory=dict)

    def counter(self, name: str) -> Counter:
        if name not in self.counters:
            self.counters[name] = Counter(name=name)
        return self.counters[name]

    def export(self) -> dict[str, int]:
        return {name: counter.value for name, counter in self.counters.items()}

