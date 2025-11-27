type FullScreenLoaderProps = {
  label?: string
}

const FullScreenLoader = ({ label = "Preparing your dashboard" }: FullScreenLoaderProps) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="flex flex-col items-center justify-center">
        <div className="relative mb-6">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" aria-hidden />
          <span className="block h-16 w-16 rounded-full border-4 border-slate-800 border-t-primary animate-spin" />
          <span className="absolute inset-2 rounded-full bg-slate-900" aria-hidden />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">{label}</p>
        </div>
      </div>
    </div>
  )
}

export default FullScreenLoader
