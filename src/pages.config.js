/**
 * Page routing configuration.
 *
 * Each key in PAGES is served at `/<Key>` (see App.jsx); `mainPage` is also
 * rendered at `/`. Layout wraps every page.
 */
import AddonDetail from './pages/AddonDetail';
import AddonsCatalog from './pages/AddonsCatalog';
import AdminAddons from './pages/AdminAddons';
import AdminDevelopers from './pages/AdminDevelopers';
import AdminPartners from './pages/AdminPartners';
import AdminUsers from './pages/AdminUsers';
import Dashboard from './pages/Dashboard';
import DevProfile from './pages/DevProfile';
import DeveloperProfile from './pages/DeveloperProfile';
import Landing from './pages/Landing';
import Login from './pages/Login';
import OnboardingRole from './pages/OnboardingRole';
import ProfileSettings from './pages/ProfileSettings';
import PublishAddon from './pages/PublishAddon';
import Signup from './pages/Signup';
import FeatureRequests from './pages/FeatureRequests';
import VerifyEmail from './pages/VerifyEmail';
import OnboardingProfile from './pages/OnboardingProfile';
import Privacy from './pages/Privacy';
import AdminVisitLogs from './pages/AdminVisitLogs';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AddonDetail": AddonDetail,
    "AddonsCatalog": AddonsCatalog,
    "AdminAddons": AdminAddons,
    "AdminDevelopers": AdminDevelopers,
    "AdminPartners": AdminPartners,
    "AdminUsers": AdminUsers,
    "Dashboard": Dashboard,
    "DevProfile": DevProfile,
    "DeveloperProfile": DeveloperProfile,
    "Landing": Landing,
    "Login": Login,
    "OnboardingRole": OnboardingRole,
    "ProfileSettings": ProfileSettings,
    "PublishAddon": PublishAddon,
    "Signup": Signup,
    "FeatureRequests": FeatureRequests,
    "VerifyEmail": VerifyEmail,
    "OnboardingProfile": OnboardingProfile,
    "Privacy": Privacy,
    "AdminVisitLogs": AdminVisitLogs,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};