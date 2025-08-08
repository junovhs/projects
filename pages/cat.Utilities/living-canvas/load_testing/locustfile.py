# This file is designed to be run with `locust -f locustfile.py --host=http://localhost:8000`

from locust import HttpUser, task, between
import random

class LivingCanvasUser(HttpUser):
    wait_time = between(1, 3)
    # These would be configured via environment variables in a real test
    NUM_PERSON_ITEMS = 100000
    NUM_TRANSACTION_ITEMS = 1000000

    @task(10)
    def get_item_by_id(self):
        """Simulates a user loading an existing Item (indexed lookup)."""
        item_type = "persons" if random.random() > 0.5 else "transactions"
        item_id = random.randint(1, self.NUM_PERSON_ITEMS if item_type == "persons" else self.NUM_TRANSACTION_ITEMS)
        self.client.get(f"/api/v1/items/{item_type}/{item_id}", name="/api/v1/items/[type]/[id]")

    @task(5)
    def get_item_with_links(self):
        """Simulates getting an Item and its direct relationships (graph traversal)."""
        person_id = random.randint(1, self.NUM_PERSON_ITEMS)
        self.client.get(f"/api/v1/items/persons/{person_id}?include=links", name="/api/v1/items/[type]/[id]?include=links")

    @task(1)
    def update_item_property(self):
        """Simulates a user updating a property on an existing Item."""
        person_id = random.randint(1, self.NUM_PERSON_ITEMS)
        patch_data = [{"op": "replace", "path": "/properties/lastName", "value": f"updated_name_{random.randint(1000,9999)}"}]
        self.client.patch(f"/api/v1/items/persons/{person_id}", json=patch_data, name="/api/v1/items/[type]/[id]")
