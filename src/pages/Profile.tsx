import React, { useState, useRef, useEffect } from 'react';
import { User } from '../services/mockData';
import { useTheme } from '../context/ThemeContext';
import {
  User as UserIcon,
  Mail,
  Lock,
  Camera,
  Save,
  Eye,
  EyeOff,
  Loader2,
  Check,
  X,
  Bell,
  Moon,
  Sun,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface ProfileProps {
  onUserUpdate?: (user: User) => void;
}

const Profile: React.FC<ProfileProps> = ({ onUserUpdate }) => {
  const { theme, toggleTheme } = useTheme();

  // Get user from localStorage
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'preferences'>('profile');

  // Loading and success states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Preferences states
  const [emailNotifications, setEmailNotifications] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('rh_user');
    if (saved) {
      const userData = JSON.parse(saved);
      setUser(userData);
      setName(userData.name || '');
      const savedImage = localStorage.getItem('rh_user_image');
      if (savedImage) {
        setProfileImage(savedImage);
      }
    }

    const savedPrefs = localStorage.getItem('rh_user_preferences');
    if (savedPrefs) {
      setEmailNotifications(JSON.parse(savedPrefs).email ?? true);
    }
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('La imagen no puede superar los 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setProfileImage(base64);
        localStorage.setItem('rh_user_image', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSavingProfile(true);
    setProfileSaved(false);

    await new Promise(resolve => setTimeout(resolve, 800));

    const updatedUser = { ...user, name };
    localStorage.setItem('rh_user', JSON.stringify(updatedUser));
    setUser(updatedUser);

    if (onUserUpdate) {
      onUserUpdate(updatedUser);
    }

    setSavingProfile(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const handleSavePassword = async () => {
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Todos los campos son obligatorios');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError('La contraseña debe tener al menos 4 caracteres');
      return;
    }

    setSavingPassword(true);
    setPasswordSaved(false);

    await new Promise(resolve => setTimeout(resolve, 800));

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    setSavingPassword(false);
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 2000);
  };

  const handleToggleEmailNotifications = () => {
    const newValue = !emailNotifications;
    setEmailNotifications(newValue);
    localStorage.setItem('rh_user_preferences', JSON.stringify({ email: newValue }));
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-orange-500" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 w-full max-w-2xl mx-auto">
      {/* Profile Card */}
      <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Profile Header with Image */}
        <div className="relative bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 px-6 sm:px-8 md:px-10 py-8 sm:py-10 md:py-12">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 blur-xl" />

          <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6 md:gap-8">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/30 shadow-xl flex items-center justify-center overflow-hidden transition-transform hover:scale-105">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl sm:text-5xl font-semibold text-white">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-1 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-orange-50 transition-all hover:scale-110 group-hover:shadow-xl"
                title="Cambiar foto de perfil"
              >
                <Camera size={18} className="text-orange-600" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>

            {/* Name and Email */}
            <div className="text-center sm:text-left flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">{user.name}</h2>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                <Mail size={16} className="text-white/80" />
                <span className="text-white/90 text-sm sm:text-base">{user.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-stone-800 bg-slate-50/50 dark:bg-stone-900/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 min-w-fit px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium transition-all relative whitespace-nowrap ${
              activeTab === 'profile'
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-slate-600 dark:text-stone-400 hover:text-slate-800 dark:hover:text-stone-300 hover:bg-slate-100/50 dark:hover:bg-stone-800/50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <UserIcon size={16} />
              Datos personales
            </span>
            {activeTab === 'profile' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-orange-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 min-w-fit px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium transition-all relative whitespace-nowrap ${
              activeTab === 'password'
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-slate-600 dark:text-stone-400 hover:text-slate-800 dark:hover:text-stone-300 hover:bg-slate-100/50 dark:hover:bg-stone-800/50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Lock size={16} />
              Seguridad
            </span>
            {activeTab === 'password' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-orange-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex-1 min-w-fit px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium transition-all relative whitespace-nowrap ${
              activeTab === 'preferences'
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-slate-600 dark:text-stone-400 hover:text-slate-800 dark:hover:text-stone-300 hover:bg-slate-100/50 dark:hover:bg-stone-800/50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Bell size={16} />
              Preferencias
            </span>
            {activeTab === 'preferences' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-orange-600" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 sm:p-8">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Name Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-stone-300">
                  Nombre completo
                </label>
                <div className="relative">
                  <UserIcon
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-stone-800/50 border-2 border-slate-200 dark:border-stone-700 rounded-xl text-slate-900 dark:text-stone-100 text-base focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all placeholder:text-slate-400 dark:placeholder:text-stone-500"
                    placeholder="Tu nombre completo"
                  />
                </div>
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-stone-300">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none"
                  />
                  <input
                    type="email"
                    value={user.email}
                    readOnly
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-100 dark:bg-stone-800/30 border-2 border-slate-200 dark:border-stone-700 rounded-xl text-slate-600 dark:text-stone-400 text-base cursor-not-allowed"
                  />
                </div>
                <p className="text-sm text-slate-500 dark:text-stone-500 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-stone-500"></span>
                  El correo electrónico no se puede modificar
                </p>
              </div>

              {/* Save Button */}
              <div className="pt-4 flex items-center gap-3">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile || name === user.name}
                  className="flex items-center justify-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:scale-105 disabled:hover:scale-100 disabled:hover:shadow-none text-base shadow-md"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : profileSaved ? (
                    <>
                      <Check size={18} />
                      <span>¡Guardado!</span>
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      <span>Guardar cambios</span>
                    </>
                  )}
                </button>

                {profileSaved && (
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium animate-in fade-in">
                    Cambios guardados correctamente
                  </span>
                )}
              </div>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="space-y-6">
              {/* Current Password */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-stone-300">
                  Contraseña actual
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none"
                  />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 dark:bg-stone-800/50 border-2 border-slate-200 dark:border-stone-700 rounded-xl text-slate-900 dark:text-stone-100 text-base focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all placeholder:text-slate-400 dark:placeholder:text-stone-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300 transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-stone-300">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none"
                  />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 dark:bg-stone-800/50 border-2 border-slate-200 dark:border-stone-700 rounded-xl text-slate-900 dark:text-stone-100 text-base focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all placeholder:text-slate-400 dark:placeholder:text-stone-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300 transition-colors"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-stone-300">
                  Confirmar nueva contraseña
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none"
                  />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 dark:bg-stone-800/50 border-2 border-slate-200 dark:border-stone-700 rounded-xl text-slate-900 dark:text-stone-100 text-base focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all placeholder:text-slate-400 dark:placeholder:text-stone-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {passwordError && (
                <div className="flex items-center gap-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3.5 rounded-xl text-base border-2 border-red-200 dark:border-red-800/40 animate-in fade-in">
                  <X size={18} className="shrink-0" />
                  <span className="font-medium">{passwordError}</span>
                </div>
              )}

              {/* Save Button */}
              <div className="pt-4 flex items-center gap-3">
                <button
                  onClick={handleSavePassword}
                  disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="flex items-center justify-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:scale-105 disabled:hover:scale-100 disabled:hover:shadow-none text-base shadow-md"
                >
                  {savingPassword ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Actualizando...</span>
                    </>
                  ) : passwordSaved ? (
                    <>
                      <Check size={18} />
                      <span>¡Actualizada!</span>
                    </>
                  ) : (
                    <>
                      <Lock size={18} />
                      <span>Actualizar contraseña</span>
                    </>
                  )}
                </button>

                {passwordSaved && (
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium animate-in fade-in">
                    Contraseña actualizada correctamente
                  </span>
                )}
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              {/* Appearance */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-stone-200 flex items-center gap-2">
                  <Sun size={18} className="text-orange-500" />
                  Apariencia
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => theme !== 'light' && toggleTheme()}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      theme === 'light'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-slate-200 dark:border-stone-700 hover:border-orange-300 dark:hover:border-orange-700'
                    }`}
                  >
                    <Sun size={24} className={theme === 'light' ? 'text-orange-500' : 'text-slate-400 dark:text-stone-500'} />
                    <span className={`text-sm font-medium ${theme === 'light' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-stone-400'}`}>
                      Claro
                    </span>
                  </button>
                  <button
                    onClick={() => theme !== 'dark' && toggleTheme()}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      theme === 'dark'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-slate-200 dark:border-stone-700 hover:border-orange-300 dark:hover:border-orange-700'
                    }`}
                  >
                    <Moon size={24} className={theme === 'dark' ? 'text-orange-500' : 'text-slate-400 dark:text-stone-500'} />
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-stone-400'}`}>
                      Oscuro
                    </span>
                  </button>
                </div>
              </div>

              {/* Email Notifications */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-stone-200 flex items-center gap-2">
                  <Bell size={18} className="text-orange-500" />
                  Notificaciones
                </h3>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-stone-800/50 rounded-xl border border-slate-200 dark:border-stone-700">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                      <Mail size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-stone-300">Notificaciones por email</p>
                      <p className="text-xs text-slate-500 dark:text-stone-400">Recibe actualizaciones importantes</p>
                    </div>
                  </div>
                  <button onClick={handleToggleEmailNotifications} className="transition-all">
                    {emailNotifications ? (
                      <ToggleRight size={28} className="text-orange-500" />
                    ) : (
                      <ToggleLeft size={28} className="text-slate-400 dark:text-stone-500" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;