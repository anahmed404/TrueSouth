"""Plain HTTP rejection shared by admission and atomic publication."""
class Rejected(Exception):
    def __init__(self, status, message, retry=None):
        self.status, self.message, self.retry = status, message, retry
