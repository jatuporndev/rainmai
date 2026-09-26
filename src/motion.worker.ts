import { estimateMotion, type MotionInput } from './motion';
self.onmessage = (event: MessageEvent<MotionInput>) => { self.postMessage(estimateMotion(event.data)); };
