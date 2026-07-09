import { lazy, Suspense } from 'react';
import { DialogProvider } from './components/DialogProvider';
import { ToastProvider } from './components/ToastProvider';

const RiveraShell = lazy(() => import('./app/RiveraShell'));

function App() {
  return (
    <ToastProvider>
      <DialogProvider>
        <Suspense fallback={<div className="grid min-h-screen place-items-center bg-background-default text-text-primary">Rivera</div>}>
          <RiveraShell />
        </Suspense>
      </DialogProvider>
    </ToastProvider>
  );
}

export default App;
