"""Errors raised while validating or building a Part Spec."""


class SpecError(ValueError):
    """The spec cannot be built. `errors` lists every problem found, one plain sentence each."""

    def __init__(self, errors: list[str]) -> None:
        self.errors = errors
        super().__init__("; ".join(errors))
