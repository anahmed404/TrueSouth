"""Plain HTTP rejection shared by admission and atomic publication."""
class Rejected(Exception):
    def __init__(self, status, message, retry=None, *, code="computation_failed"):
        self.status, self.message, self.retry, self.code = status, message, retry, code
