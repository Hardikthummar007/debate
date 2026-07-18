package com.debait.contestservice.service;

import com.debait.contestservice.model.*;
import com.debait.contestservice.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;

@Service
public class WagerService {

    private final UserRepository userRepository;
    private final BetRepository betRepository;
    private final BetSettingRepository betSettingRepository;
    private final NotificationRepository notificationRepository;
    private final DebateSessionRepository debateSessionRepository;

    public WagerService(UserRepository userRepository, BetRepository betRepository,
                        BetSettingRepository betSettingRepository, NotificationRepository notificationRepository,
                        DebateSessionRepository debateSessionRepository) {
        this.userRepository = userRepository;
        this.betRepository = betRepository;
        this.betSettingRepository = betSettingRepository;
        this.notificationRepository = notificationRepository;
        this.debateSessionRepository = debateSessionRepository;
    }

    public BetSetting getSettings() {
        List<BetSetting> settings = betSettingRepository.findAll();
        if (settings.isEmpty()) {
            BetSetting defaultSetting = new BetSetting();
            return betSettingRepository.save(defaultSetting);
        }
        return settings.get(0);
    }

    @Transactional
    public BetSetting updateSettings(BetSetting updates) {
        BetSetting current = getSettings();
        current.setHouseEdgePct(updates.getHouseEdgePct());
        current.setMinBet(updates.getMinBet());
        current.setMaxBetPctOfBalance(updates.getMaxBetPctOfBalance());
        current.setHouseBonusPerWinner(updates.getHouseBonusPerWinner());
        current.setHouseBonusCapPerMatch(updates.getHouseBonusCapPerMatch());
        current.setDailyBonusBetLimit(updates.getDailyBonusBetLimit());
        return betSettingRepository.save(current);
    }

    @Transactional
    public Bet placeBet(User user, Long matchId, String side, int amount) {
        DebateSession session = debateSessionRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("Debate session not found."));

        if (!"ACTIVE".equals(session.getStatus())) {
            throw new IllegalArgumentException("Wagers can only be placed on active debates.");
        }

        // Betting locked if the first round has any arguments submitted
        boolean roundOneStarted = !session.getRounds().isEmpty() && 
                !session.getRounds().get(0).getArguments().isEmpty();
        if (roundOneStarted || session.getCurrentRound() > 1) {
            throw new IllegalArgumentException("Betting is locked. The first round of the debate has already started.");
        }

        // Cannot bet on your own match
        if (user.getId().equals(session.getParticipantA().getId()) || 
            user.getId().equals(session.getParticipantB().getId())) {
            throw new IllegalArgumentException("Chamber rules forbid wagering on your own match.");
        }

        BetSetting settings = getSettings();

        if (amount < settings.getMinBet()) {
            throw new IllegalArgumentException("Minimum wager is " + settings.getMinBet() + " gold coins.");
        }

        double maxBetAllowed = user.getCoins() * settings.getMaxBetPctOfBalance();
        if (amount > maxBetAllowed) {
            throw new IllegalArgumentException("Wager exceeds the current House limit of " + 
                    (int) settings.getMaxBetPctOfBalance() * 100 + "% of your balance (Max: " + (int) maxBetAllowed + "G).");
        }

        if (user.getCoins() < amount) {
            throw new IllegalArgumentException("Insufficient gold coins in your vaults.");
        }

        // Deduct coins
        user.setCoins(user.getCoins() - amount);
        userRepository.save(user);

        Bet bet = new Bet(matchId, user, side.toUpperCase(), amount);
        return betRepository.save(bet);
    }

    @Transactional
    public void resolveWagers(DebateSession session) {
        List<Bet> bets = betRepository.findByMatchId(session.getId());
        if (bets.isEmpty()) {
            return;
        }

        BetSetting settings = getSettings();

        // 1. Calculate side totals
        int sideAPool = 0;
        int sideBPool = 0;
        List<Bet> sideABets = new ArrayList<>();
        List<Bet> sideBBets = new ArrayList<>();

        for (Bet bet : bets) {
            if ("A".equals(bet.getSide())) {
                sideAPool += bet.getStakeAmount();
                sideABets.add(bet);
            } else {
                sideBPool += bet.getStakeAmount();
                sideBBets.add(bet);
            }
        }

        // 2. Identify winner
        User winner = session.getWinner();
        String winningSide = null;
        if (winner != null) {
            if (winner.getId().equals(session.getParticipantA().getId())) {
                winningSide = "A";
            } else if (winner.getId().equals(session.getParticipantB().getId())) {
                winningSide = "B";
            }
        }

        boolean isDraw = (winningSide == null);

        if (isDraw) {
            // Case D: Tie / Push -> Refund stakes
            for (Bet bet : bets) {
                bet.setStatus("REFUNDED");
                bet.setPayoutAmount(bet.getStakeAmount());
                betRepository.save(bet);

                User bettor = bet.getUser();
                bettor.setCoins(bettor.getCoins() + bet.getStakeAmount());
                userRepository.save(bettor);

                Notification n = new Notification(bettor, 
                        "A raven arrives: The debate on '" + session.getTopic() + "' ended in a push. Your wager of " + bet.getStakeAmount() + "G has been returned to your vaults.");
                notificationRepository.save(n);
            }
            return;
        }

        List<Bet> winningBets = "A".equals(winningSide) ? sideABets : sideBBets;
        List<Bet> losingBets = "A".equals(winningSide) ? sideBBets : sideABets;
        int winningPoolTotal = "A".equals(winningSide) ? sideAPool : sideBPool;
        int losingPoolTotal = "A".equals(winningSide) ? sideBPool : sideAPool;

        String winningHouseName = "A".equals(winningSide) 
                ? "House " + session.getParticipantA().getUsername() 
                : "House " + session.getParticipantB().getUsername();

        // Case C: All bettors bet on the losing side
        if (winningBets.isEmpty()) {
            for (Bet bet : losingBets) {
                bet.setStatus("LOST");
                bet.setPayoutAmount(0);
                betRepository.save(bet);

                Notification n = new Notification(bet.getUser(), 
                        "A raven arrives: Your wager on the debate '" + session.getTopic() + "' was lost. The house has claimed your stake.");
                notificationRepository.save(n);
            }
            return;
        }

        // Case B: All bettors bet on the winning side (losing pool is empty)
        if (losingBets.isEmpty()) {
            LocalDateTime todayStart = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);
            int winnersCount = winningBets.size();
            
            // Calculate house-funded bonus pool
            int rawBonusPool = settings.getHouseBonusPerWinner() * winnersCount;
            int bonusPool = Math.min(rawBonusPool, settings.getHouseBonusCapPerMatch());

            for (Bet bet : winningBets) {
                User bettor = bet.getUser();
                int dailyBonusCount = betRepository.countWinningBonusBetsSince(bettor, todayStart);
                
                int payoutAmount = bet.getStakeAmount();
                boolean eligibleForBonus = (dailyBonusCount < settings.getDailyBonusBetLimit());

                if (eligibleForBonus) {
                    double share = (double) bet.getStakeAmount() / winningPoolTotal;
                    int bonusShare = (int) Math.round(share * bonusPool);
                    payoutAmount += bonusShare;
                    bet.setBonusEarned(true);
                } else {
                    bet.setBonusEarned(false);
                }

                bet.setStatus("WON");
                bet.setPayoutAmount(payoutAmount);
                betRepository.save(bet);

                bettor.setCoins(bettor.getCoins() + payoutAmount);
                userRepository.save(bettor);

                String msg = eligibleForBonus 
                        ? "A raven arrives: Your wager on " + winningHouseName + " has won! All bettors backed this stance. You received a house-funded bonus! +" + payoutAmount + "G added to your vaults."
                        : "A raven arrives: Your wager on " + winningHouseName + " has won! However, you have reached your daily limit of " + settings.getDailyBonusBetLimit() + " bonus wagers. Your stake has been returned.";
                Notification n = new Notification(bettor, msg);
                notificationRepository.save(n);
            }
            return;
        }

        // Case A: Bets exist on both sides, and one side wins
        double distributablePool = losingPoolTotal * (1 - settings.getHouseEdgePct());

        for (Bet bet : winningBets) {
            double share = (double) bet.getStakeAmount() / winningPoolTotal;
            int winnings = (int) Math.round(share * distributablePool);
            int payoutAmount = bet.getStakeAmount() + winnings;

            bet.setStatus("WON");
            bet.setPayoutAmount(payoutAmount);
            betRepository.save(bet);

            User bettor = bet.getUser();
            bettor.setCoins(bettor.getCoins() + payoutAmount);
            userRepository.save(bettor);

            Notification n = new Notification(bettor, 
                    "A raven arrives: Your wager on " + winningHouseName + " has paid off! You earned +" + winnings + "G spoils. Total payout of " + payoutAmount + "G has been added to your vaults.");
            notificationRepository.save(n);
        }

        for (Bet bet : losingBets) {
            bet.setStatus("LOST");
            bet.setPayoutAmount(0);
            betRepository.save(bet);

            Notification n = new Notification(bet.getUser(), 
                    "A raven arrives: Your wager on " + winningHouseName + " was lost. Your stake has been claimed as spoils.");
            notificationRepository.save(n);
        }
    }
}
