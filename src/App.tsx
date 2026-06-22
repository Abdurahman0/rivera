import { lazy, Suspense } from 'react';

const RiveraShell = lazy(() => import('./app/RiveraShell'));

function App() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-background-default text-text-primary">Rivera</div>}>
      <RiveraShell />
    </Suspense>
  );
}

export default App;
