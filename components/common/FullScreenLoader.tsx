import { TextShimmerWave } from "../motion-primitives/text-shimmer-wave";

type FullScreenLoaderProps = {
  label?: string;
};

const FullScreenLoader = ({ label = "Loading..." }: FullScreenLoaderProps) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="flex flex-col items-center justify-center">
        <div className="text-center">
          <TextShimmerWave className="font-mono text-sm" duration={1}>
            {label}
          </TextShimmerWave>
        </div>
      </div>
    </div>
  );
};

export default FullScreenLoader;
