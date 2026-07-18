import unittest
import subprocess
import time
import requests
import asyncio
import websockets
import json

class TestPrivateRoom(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Start server subprocess and redirect output to a log file on port 8001
        cls.log_file = open("server_test.log", "w")
        cls.server_proc = subprocess.Popen(
            [".venv/bin/python", "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "8001"],
            stdout=cls.log_file,
            stderr=subprocess.STDOUT,
            text=True
        )
        time.sleep(10) # Await server startup

    @classmethod
    def tearDownClass(cls):
        cls.server_proc.terminate()
        try:
            cls.server_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.server_proc.kill()
        cls.log_file.close()

    def test_flow(self):
        async def run_test():
            # 1. Create Room
            res = requests.post("http://127.0.0.1:8001/api/rooms/create", json={
                "hostUserId": "user1",
                "hostUsername": "HostStark",
                "rounds": 1
            })
            self.assertEqual(res.status_code, 200)
            room_code = res.json()["roomCode"]

            # 2. Join Room
            res_join = requests.post("http://127.0.0.1:8001/api/rooms/join", json={
                "roomCode": room_code,
                "userId": "user2",
                "username": "GuestTarg"
            })
            self.assertEqual(res_join.status_code, 200)

            # 3. Connect Host and Guest
            uri_host = f"ws://127.0.0.1:8001/ws/room/{room_code}/user1"
            uri_guest = f"ws://127.0.0.1:8001/ws/room/{room_code}/user2"

            async with websockets.connect(uri_host) as ws_host, websockets.connect(uri_guest) as ws_guest:
                # Consume initial state updates
                msg_h1 = json.loads(await ws_host.recv())
                self.assertEqual(msg_h1["type"], "room_state_update")
                
                msg_g1 = json.loads(await ws_guest.recv())
                self.assertEqual(msg_g1["type"], "room_state_update")
                
                # Host gets Guest join state update too
                msg_h2 = json.loads(await ws_host.recv())
                self.assertEqual(msg_h2["type"], "room_state_update")

                # Set topic
                await ws_host.send(json.dumps({"action": "set_topic", "topic": "AI will replace humans"}))
                msg_h_t = json.loads(await ws_host.recv())
                self.assertEqual(msg_h_t["room"]["topic"], "AI will replace humans")
                
                msg_g_t = json.loads(await ws_guest.recv())
                self.assertEqual(msg_g_t["room"]["topic"], "AI will replace humans")

                # Confirm topic
                await ws_host.send(json.dumps({"action": "confirm_topic"}))
                await ws_guest.send(json.dumps({"action": "confirm_topic"}))
                
                # Consume topic confirmations
                await ws_host.recv()
                await ws_host.recv()
                await ws_guest.recv()
                await ws_guest.recv()

                # Choose side
                await ws_host.send(json.dumps({"action": "choose_side", "side": "FOR"}))
                
                # Active room state
                active_h = json.loads(await ws_host.recv())
                active_g = json.loads(await ws_guest.recv())
                self.assertEqual(active_h["room"]["status"], "ACTIVE")

                # Submit Argument 1 (Host)
                await ws_host.send(json.dumps({"action": "submit_argument", "argumentText": "AI does things faster."}))

                # Consume stream events on both sockets concurrently to avoid queue deadlocks
                async def consume_eval(ws, name):
                    while True:
                        msg = json.loads(await ws.recv())
                        print(f"[{name} RECV] type={msg.get('type')}, event={msg.get('event')}")
                        if msg.get("type") == "eval_event":
                            if msg.get("event") == "done":
                                break
                            elif msg.get("event") == "error":
                                raise Exception(f"Eval error: {msg.get('data')}")

                await asyncio.gather(
                    consume_eval(ws_host, "HOST"),
                    consume_eval(ws_guest, "GUEST")
                )

                # Read turn updates
                await ws_host.recv()
                await ws_guest.recv()

                # Submit Argument 2 (Guest)
                await ws_guest.send(json.dumps({"action": "submit_argument", "argumentText": "But AI lacks creativity."}))

                # Consume stream events concurrently
                await asyncio.gather(
                    consume_eval(ws_host, "HOST"),
                    consume_eval(ws_guest, "GUEST")
                )

                # Final COMPLETED updates
                final_h = json.loads(await ws_host.recv())
                final_g = json.loads(await ws_guest.recv())
                self.assertEqual(final_h["room"]["status"], "COMPLETED")
                self.assertIsNotNone(final_h["room"]["evaluation_result"])

        asyncio.run(run_test())

if __name__ == "__main__":
    unittest.main()
